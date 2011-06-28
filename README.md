# Require-kernel #

This is a solid, unadorned implementation of the emerging [CommonJS module standard](http://wiki.commonjs.org/wiki/Modules/1.1).

## Interface ##
The kernel evaluates to an unnamed function that can be invoked in the following ways:

* `module = require(path)`
* `require(path1[, path2[, path3], function (module1, module2, module3) {})`

The function has the following methods:

* `define`: A method for defining modules. It may be invoked one of several ways. In either case the path is expected to be fully qualified and the module a function with the signature `(require, exports, module)`.
  * `require.define(path, module)`
  * `require.define({path1: module1, path2: module2, path3: module3})`
* `setGlobalKeyPath`: A string (such as `"require"` and `"namespace.req"`) that evaluates to the kernel in the global scope. Asynchronous retrieval of modules using JSONP will happen if and only if this path is defined. Default is `undefined`.
* `setRootURI`: The URI that non-library paths will be requested relative to. Default is `undefined`.
* `setLibraryURI`: The URI that library paths (i.e. paths that do not match `/^\.{0,2}\//`) will be requested relative to. Default is `undefined`.

## License ##
Released under zlib

    Copyright (C) 2011 Chad Weider

    This software is provided 'as-is', without any express or implied   
    warranty. In no event will the authors be held liable for any damages   
    arising from the use of this software.

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
