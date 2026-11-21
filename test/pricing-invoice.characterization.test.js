'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var coupons = require('../lib/coupons');
var config = require('../config');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var tax = require('../lib/tax');

test('order pricing applies coupon discount before HSN GST and returns a split', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', price: 1000, qty: 1 }];
  var totals = pricing.computeTotals(items, 'SAVE10');

  assert.deepEqual({
    subtotal: totals.subtotal,
    discount: totals.discount,
    taxable: totals.taxable,
    tax: totals.tax,
    cgst: totals.cgst,
    sgst: totals.sgst,
    total: totals.total
  }, {
    subtotal: 1000,
    discount: 100,
    taxable: 900,
    tax: 45,
    cgst: 22.5,
    sgst: 22.5,
    total: 945
  });
  assert.deepEqual(totals.lines[0], {
    id: 1,
    name: 'Rice',
    hsn: '1006',
    gstPercent: 5,
    gross: 1000,
    discount: 100,
    taxable: 900,
    tax: 45,
    net: 945
  });
});

test('coupon validation normalizes codes and calculates the configured percentage discount cap', function () {
  var result = coupons.validate(' save10 ', 3000);

  assert.equal(result.valid, true);
  assert.equal(result.code, 'SAVE10');
  assert.equal(result.discount, 150);
  assert.equal(coupons.calculateDiscount(3000, 'SAVE10'), 150);
});

test('tax resolves configured HSN slabs and uses the default rate for an unknown HSN', function () {
  assert.equal(tax.getRateForItem({ hsn: '1006' }), 0.05);
  assert.equal(tax.getRateForItem({ hsn: '0405' }), 0.12);
  assert.equal(tax.getRateForItem({ hsn: '0902' }), 0.18);
  assert.equal(tax.getRateForItem({ hsn: '9999' }), 0.18);

  var totals = pricing.computeTotals([
    { id: 1, name: 'Rice', hsn: '1006', price: 1000, qty: 1 },
    { id: 2, name: 'Ghee', hsn: '0405', price: 1000, qty: 1 }
  ], '');
  assert.equal(totals.tax, 170);
  assert.equal(totals.cgst, 85);
  assert.equal(totals.sgst, 85);
  assert.deepEqual(totals.lines.map(function (line) { return [line.gstPercent, line.tax]; }), [[5, 50], [12, 120]]);
});

test('invoice uses recorded order totals when historical line GST details are absent', function () {
  var order = {
    items: [{ name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 1000, qty: 1 }],
    coupon: '',
    subtotal: 1000,
    discount: 0,
    tax: 50,
    total: 1050
  };
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.rows[0].gstPercent, null);
  assert.equal(figures.rows[0].lineTax, null);
  assert.equal(figures.subtotal, 1000);
  assert.equal(figures.discount, 0);
  assert.equal(figures.taxable, 1000);
  assert.equal(figures.tax, 50);
  assert.equal(figures.cgst, 25);
  assert.equal(figures.sgst, 25);
  assert.equal(figures.total, 1050);
});

test('historical invoice GST totals do not change when current HSN rates change', function () {
  var order = {
    items: [{ name: 'Ghee', sku: 'DRY-001', hsn: '0405', price: 1000, qty: 1 }],
    coupon: '',
    subtotal: 1000,
    discount: 0,
    tax: 120,
    total: 1120
  };

  var originalRate = config.tax.hsnSlabs['0405'];
  try {
    config.tax.hsnSlabs['0405'] = 18;
    var figures = invoice.computeInvoiceFigures(order);
    var html = invoice.render(order);
    assert.equal(figures.rows[0].gstPercent, null);
    assert.equal(figures.rows[0].lineTax, null);
    assert.equal(figures.tax, 120);
    assert.equal(figures.cgst, 60);
    assert.equal(figures.sgst, 60);
    assert.equal(figures.total, 1120);
    assert.match(html, /CGST<\/td><td class="r">[^<]*60\.00/);
    assert.match(html, /SGST<\/td><td class="r">[^<]*60\.00/);
    assert.match(html, /Invoice Total<\/td><td class="r">[^<]*1120\.00/);
  } finally {
    config.tax.hsnSlabs['0405'] = originalRate;
  }
});

test('historical invoice discount and total do not change when current coupon configuration changes', function () {
  var order = {
    items: [{ name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 2240, qty: 1 }],
    coupon: 'SAVE10',
    subtotal: 2240,
    discount: 150,
    tax: 104.5,
    total: 2194.5
  };
  var originalCoupon = Object.assign({}, config.coupons.SAVE10);
  try {
    config.coupons.SAVE10.type = 'flat';
    config.coupons.SAVE10.value = 900;
    var figures = invoice.computeInvoiceFigures(order);
    var html = invoice.render(order);
    assert.equal(figures.subtotal, 2240);
    assert.equal(figures.discount, 150);
    assert.equal(figures.taxable, 2090);
    assert.equal(figures.tax, 104.5);
    assert.equal(figures.cgst, 52.25);
    assert.equal(figures.sgst, 52.25);
    assert.equal(figures.total, 2194.5);
    assert.match(html, /Coupon Discount \(SAVE10\)<\/td><td class="r"[^>]*>-.*150\.00/);
    assert.match(html, /Taxable Amount After Discount<\/td><td class="r">[^<]*2090\.00/);
    assert.match(html, /Invoice Total<\/td><td class="r">[^<]*2194\.50/);
  } finally {
    config.coupons.SAVE10 = originalCoupon;
  }
});

test('invoice breakdown displays the discounted taxable amount and reconciles to the total', function () {
  var html = invoice.render({
    id: 2001,
    items: [{ name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 1000, qty: 1 }],
    coupon: 'SAVE10',
    subtotal: 1000,
    discount: 100,
    tax: 45,
    total: 945
  });

  assert.match(html, /Gross Subtotal<\/td><td class="r">[^<]*1000\.00/);
  assert.match(html, /Coupon Discount \(SAVE10\)<\/td><td class="r"[^>]*>-.*100\.00/);
  assert.match(html, /Taxable Amount After Discount<\/td><td class="r">[^<]*900\.00/);
  assert.match(html, /CGST<\/td><td class="r">[^<]*22\.50/);
  assert.match(html, /SGST<\/td><td class="r">[^<]*22\.50/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">[^<]*45\.00/);
  assert.match(html, /Invoice Total<\/td><td class="r">[^<]*945\.00/);
  assert.ok(html.includes('class="r">&mdash;</td><td class="r">&mdash;</td>'));
});
