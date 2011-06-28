/*!

  Copyright (C) 2011 Chad Weider

  This software is provided 'as-is', without any express or implied warranty. 
  In no event will the authors be held liable for any damages arising from the
  use of this software.

  Permission is granted to anyone to use this software for any purpose,
  including commercial applications, and to alter it and redistribute it
  freely, subject to the following restrictions:

  1. The origin of this software must not be misrepresented; you must not
     claim that you wrote the original software. If you use this software in
     a product, an acknowledgment in the product documentation would be
     appreciated but is not required.
  2. Altered source versions must be plainly marked as such, and must not be
     misrepresented as being the original software.
  3. This notice may not be removed or altered from any source distribution.

*/

var sys = require('sys');
var fs = require('fs');
var util = require('util');
var pathutil = require('path');
var requireForPaths = require('./mock_require').requireForPaths;

function assertEqual(expected, actual, reason) {
  if (expected == actual) {
    console.log('.');
  } else {
    console.log('F');
    console.log(expected + ' != '  + actual);
    throw new Error()
  }
}
function assertThrow(f, arguments) {
  var thrown = false;
  try {
    f.apply(this, arguments);
  } catch (e) {
    thrown = true;
  } finally {
    assertEqual(true, thrown);
  }
}

/* Test library resolution. */
r = requireForPaths('root', 'library');
assertEqual('1.js', r('1.js').value);
assertEqual('/1.js', r('/1.js').value);
/* Test suffix resolution. */
assertEqual('/1.js', r('/1').value);
assertEqual(r('/1.js'), r('/1'));

/* Test questionable 'extra' relative paths. */
r = requireForPaths('root', 'library');
assertEqual('/../root/1.js', r('/../root/1').value);
assertEqual('/../library/1.js', r('../library/1').value);

/* Test index resolution. */
r = requireForPaths('index');
assertEqual('/index.js', r('/').value);
assertEqual('/index.js', r('/index').value);
assertEqual('/index/index.js', r('/index/').value);
assertEqual('/index/index.js', r('/index/index').value);
assertEqual('/index/index.js', r('/index/index.js').value);
assertEqual('/index/index/index.js', r('/index/index/').value);
assertEqual('/index/index/index.js', r('/index/index/index.js').value);

/* Test path normalization. */
assertEqual('/index.js', r('./index').value);
assertEqual('/index.js', r('/./index').value);
assertEqual('/index/index.js', r('/index/index/../').value);
assertEqual('/index/index.js', r('/index/index/../../index/').value);

/* Test exceptions. */
assertThrow(function () {require(null)});
assertThrow(function () {require('1', '1')});
assertThrow(function () {require('1', '1', '1')});

/* Test module definitions. */
r = requireForPaths();
r.define("user/module.js", function (require, exports, module) {
  exports.value = module.id;
});
r.define("user/module.js", function (require, exports, module) {
  exports.value = "REDEFINED";
});
r.define({
  "user/module1.js": function (require, exports, module) {
    exports.value = module.id;
  }
, "user/module2.js": function (require, exports, module) {
    exports.value = module.id;
  }
, "user/module3.js": function (require, exports, module) {
    exports.value = module.id;
  }
});

assertEqual('user/module.js', r('user/module').value);
assertEqual('user/module1.js', r('user/module1').value);
assertEqual('user/module2.js', r('user/module2').value);
assertEqual('user/module3.js', r('user/module3').value);
assertThrow(function () {require('user/module')});

/* Test cycle detection */
r = requireForPaths('cycles');
assertThrow(function () {require('/one_cycle')});
assertThrow(function () {require('/two_cycle')});
assertThrow(function () {require('/three_cycle')});

r.define({
  "non_cycle.1.js": function (require, exports, module) {
    exports.value = module.id;
    require("non_cycle.2.js", function (two) {exports.one = two});
  }
, "non_cycle.2.js": function (require, exports, module) {
    exports.value = module.id;
    require("non_cycle.1.js", function (one) {exports.one = one});
  }
});
var non1 = r("non_cycle.1.js");
