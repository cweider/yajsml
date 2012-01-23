# Yajsml #

Yajsml is yet another (Common)JS module loader. It is a server-side component that allows JavaScript code to be distributed in a reliable and performant way. It’s three features are:

 - Proxy pass through for individual resource requests.
 - Bulk responses for requests of closely associated resources (e.g. dependencies) when a request specifies a JSONP-style callback.
 - Canonical packaged resources where requests for disparate resources may be fulfilled through a redirect to one canonical packaged resource (which exploits warmed caches).

The tool’s interface is simple enough that there is no need for a prescribed implementation on the client-side. That said, the [require-kernel](https://github.com/cweider/require-kernel) is a terse implementation of a CommonJS module manager that can use all the features in Yajsml.

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
