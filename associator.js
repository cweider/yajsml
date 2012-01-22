/*

  Copyright (C) 2011 Chad Weider

  This software is provided 'as-is', without any express or implied
  warranty.  In no event will the authors be held liable for any damages
  arising from the use of this software.

  Permission is granted to anyone to use this software for any purpose,
  including commercial applications, and to alter it and redistribute it
  freely, subject to the following restrictions:

  1. The origin of this software must not be misrepresented; you must not
     claim that you wrote the original software. If you use this software
     in a product, an acknowledgment in the product documentation would be
     appreciated but is not required.
  2. Altered source versions must be plainly marked as such, and must not be
     misrepresented as being the original software.
  3. This notice may not be removed or altered from any source distribution.

*/

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
      if (!hasOwnProperty.call(associations, module)) {
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
    } else if (hasOwnProperty.call(packageSet, package)) {
      // BAD: Duplicate package.
    } else if (!hasOwnProperty.call(associations, package)) {
      // BAD: Package primary doesn't exist for this package
    } else if (associations[package][0] != i) {
      // BAD: Package primary doesn't agree
    }
    packageSet[package] = true;
  })

  var packageModuleMap = {};
  var modulePackageMap = {};
  for (var path in associations) {
    if (hasOwnProperty.call(associations, path)) {
      var association = associations[path];

      modulePackageMap[path] = packages[association[0]];
      association[1].forEach(function (include, i) {
        if (include) {
          var package = packages[i];
          if (!hasOwnProperty.call(packageModuleMap, package)) {
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
function Associator(associations) {
  this._packageModuleMap = associations[0];
  this._modulePackageMap = associations[1];
}
Associator.prototype = new function () {
  function preferredPath(modulePath) {
    if (hasOwnProperty.call(this._modulePackageMap, modulePath)) {
      return this._modulePackageMap[modulePath];
    } else {
      return modulePath;
    }
  }
  function associatedModulePaths(modulePath) {
    if (hasOwnProperty.call(this._packageModuleMap, modulePath)) {
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

exports.Associator = Associator;
exports.IdentityAssociator = IdentityAssociator;
exports.SimpleAssociator = SimpleAssociator;
exports.complexForSimpleMapping = complexForSimpleMapping;
exports.associationsForComplexMapping = associationsForComplexMapping;
