/*!

  Copyright (c) 2011 Chad Weider

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in
  all copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.

*/

function hasOwnProperty(o, k) {
  return Object.prototype.hasOwnProperty.call(o, k);
}

/*
  Associations describe the interfile relationships.

  INPUT:
  [ { modules:
      [ '/module/path/1.js'
      , '/module/path/2.js'
      , '/module/path/3.js'
      , '/module/path/4.js'
      ]
    }
  , { modules:
      [ '/module/path/3.js'
      , '/module/path/4.js'
      , '/module/path/5.js'
      ]
    , primary: '/module/path/4.js'
    }
  ]

  OUTPUT:
  [ [ '/module/path/1.js'
    , '/module/path/4.js'
    ]
  , { '/module/path/1.js': [0, [true, false]]
    , '/module/path/2.js': [0, [true, false]]
    , '/module/path/3.js': [1, [true, true]]
    , '/module/path/4.js': [1, [true, true]]
    , '/module/path/5.js': [1, [false, true]]
    }
  ]
*/
function complexForSimpleMapping(definitions) {
  var packages = new Array(definitions.length);
  var associations = {};
  var emptyAssociation = [];
  for (var i = 0, ii = definitions.length; i < ii; i++) {
    emptyAssociation[i] = false;
  }

  // Define associations.
  definitions.forEach(function (definition, i) {
    var primary = definition['primary'];
    var modules = definition['modules'];

    modules.forEach(function (module) {
      if (!hasOwnProperty(associations, module)) {
        associations[module] = [undefined, emptyAssociation.concat()];
      }
      associations[module][1][i] = true;
    });
  });

  // Modules specified in packages as primary get highest precedence.
  definitions.forEach(function (definition, i) {
    var primary = definition['primary'];
    var modules = definition['modules'];
    var containsPrimary = false;
    primary && modules.forEach(function (module) {
      if (module == primary) {
        containsPrimary = true;
        if (associations[module][0] !== undefined) {
          // BAD: Two packages specify this as primary
        } else {
          associations[module][0] = i;
          packages[i] = module;
        }
      }
    });
  });

  // Other modules in packages specifying primary.
  definitions.forEach(function (definition, i) {
    var primary = definition['primary'];
    var modules = definition['modules'];
    primary && modules.forEach(function (module) {
      if (associations[module][0] === undefined) {
        associations[module][0] = i;
        packages[i] = packages[i] || module;
      }
    });
  });

  // All others go to the first package using it.
  definitions.forEach(function (definition, i) {
    var primary = definition['primary'];
    var modules = definition['modules'];
    modules.forEach(function (module) {
      if (associations[module][0] === undefined) {
        associations[module][0] = i;
        packages[i] = module;
      }
    });
  });

  return [packages, associations]
}

/*
  Produce fully structured module mapings from association description.

  INPUT:
  [ [ '/module/path/1.js'
    , '/module/path/4.js'
    ]
  , { '/module/path/1.js': [0, [true, false]]
    , '/module/path/2.js': [0, [true, false]]
    , '/module/path/3.js': [1, [true, true]]
    , '/module/path/4.js': [1, [true, true]]
    , '/module/path/5.js': [1, [false, true]]
    }
  ]

  OUTPUT:
  [ { '/module/path/1.js':
      [ '/module/path/1.js'
      , '/module/path/2.js'
      , '/module/path/3.js'
      , '/module/path/4.js'
      ]
    , '/module/path/4.js':
      [ '/module/path/3.js'
      , '/module/path/4.js'
      , '/module/path/5.js'
      ]
    }
  , { '/module/path/1.js': '/module/path/1.js'
    , '/module/path/2.js': '/module/path/1.js'
    , '/module/path/3.js': '/module/path/4.js'
    , '/module/path/4.js': '/module/path/4.js'
    , '/module/path/5.js': '/module/path/4.js'
    }
  ]
*/
function associationsForComplexMapping(packages, associations) {
  var packageSet = {};
  packages.forEach(function (package, i) {
    if (package === undefined) {
      // BAD: Package has no purpose.
    } else if (hasOwnProperty(packageSet, package)) {
      // BAD: Duplicate package.
    } else if (!hasOwnProperty(associations, package)) {
      // BAD: Package primary doesn't exist for this package
    } else if (associations[package][0] != i) {
      // BAD: Package primary doesn't agree
    }
    packageSet[package] = true;
  })

  var packageModuleMap = {};
  var modulePackageMap = {};
  for (var path in associations) {
    if (hasOwnProperty(associations, path)) {
      var association = associations[path];

      modulePackageMap[path] = packages[association[0]];
      association[1].forEach(function (include, i) {
        if (include) {
          var package = packages[i];
          if (!hasOwnProperty(packageModuleMap, package)) {
            packageModuleMap[package] = [];
          }
          packageModuleMap[package].push(path);
        }
      });
    }
  }

  return [packageModuleMap, modulePackageMap];
}

/*
  I determine which modules are associated with one another for a JS module
  server.

  INPUT:
  [ { '/module/path/1.js':
      [ '/module/path/1.js'
      , '/module/path/2.js'
      , '/module/path/3.js'
      , '/module/path/4.js'
      ]
    , '/module/path/4.js':
      [ '/module/path/3.js'
      , '/module/path/4.js'
      , '/module/path/5.js'
      ]
    }
  , { '/module/path/1.js': '/module/path/1.js'
    , '/module/path/2.js': '/module/path/1.js'
    , '/module/path/3.js': '/module/path/4.js'
    , '/module/path/4.js': '/module/path/4.js'
    , '/module/path/5.js': '/module/path/4.js'
    }
  ]
*/
function StaticAssociator(associations) {
  this._packageModuleMap = associations[0];
  this._modulePackageMap = associations[1];
}
StaticAssociator.prototype = new function () {
  function preferredPath(modulePath) {
    if (hasOwnProperty(this._modulePackageMap, modulePath)) {
      return this._modulePackageMap[modulePath];
    } else {
      return modulePath;
    }
  }
  function associatedModulePaths(modulePath) {
    if (hasOwnProperty(this._packageModuleMap, modulePath)) {
      return this._packageModuleMap[modulePath];
    } else {
      return [modulePath];
    }
  }
  this.preferredPath = preferredPath;
  this.associatedModulePaths = associatedModulePaths;
}();

function IdentityAssociator() {
  // empty
}
IdentityAssociator.prototype = new function () {
  function preferredPath(modulePath) {
    return modulePath;
  }
  function associatedModulePaths(modulePath) {
    return [modulePath];
  }
  this.preferredPath = preferredPath;
  this.associatedModulePaths = associatedModulePaths;
}

function SimpleAssociator() {
  // empty
}
SimpleAssociator.prototype = new function () {
  function preferredPath(modulePath) {
    return this.associatedModulePaths(modulePath)[0];
  }
  function associatedModulePaths(modulePath) {
    var modulePath = modulePath.replace(/\.js$|(?:^|\/)index\.js$|.\/+$/, '');
    return [modulePath, modulePath + '.js', modulePath + '/index.js'];
  }
  this.preferredPath = preferredPath;
  this.associatedModulePaths = associatedModulePaths;
}

exports.StaticAssociator = StaticAssociator;
exports.IdentityAssociator = IdentityAssociator;
exports.SimpleAssociator = SimpleAssociator;
exports.complexForSimpleMapping = complexForSimpleMapping;
exports.associationsForComplexMapping = associationsForComplexMapping;
