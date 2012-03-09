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

var fs = require('fs');
var connect = require('connect');
var cors = require('connect-cors');

// This needs to be a package.
var UglifyMiddleware = require('./uglify-middleware');
var compressor = new UglifyMiddleware();
compressor._console = console;

var Yajsml = require('yajsml');
var Server = Yajsml.Server;
var associators = Yajsml.associators;

var configuration = {};
for (var i = 1, ii = process.argv.length; i < ii; i++) {
  if (process.argv[i] == '--configuration') {
    var configPath = process.argv[i+1];
    if (!configPath) {
      throw new Error("Configuration option specified, but no path given.");
    } else {
      configuration = JSON.parse(fs.readFileSync(configPath));
    }
  }
}

var assetServer = connect.createServer()
  .use(cors({
      origins: ['*']
    , methods: ['HEAD', 'GET']
    , headers: [
        'content-type'
      , 'accept'
      , 'date'
      , 'if-modified-since'
      , 'last-modified'
      , 'expires'
      , 'etag'
      , 'cache-control'
      ]
    }))
  .use(connect.cookieParser())
  ;

if (configuration['minify']) {
  assetServer.use(compressor);
}

for (var i = 0, ii = (configuration['instances'] || []).length; i < ii; i++) {
  var instanceConfiguration = configuration['instances'][i];
  var instance = new (Yajsml.Server)(instanceConfiguration);

  if (instanceConfiguration['associator']) {
    var associatorConfiguration = instanceConfiguration['associator'];
    if (associatorConfiguration['type']) {
      var type = associatorConfiguration['type'];
      if (type == 'identity') {
        instance.setAssociator(new (associators.IdentityAssociator)());
      } else if (type == 'simple') {
        instance.setAssociator(new (associators.SimpleAssociator)());
      } else if (type == 'static') {
        var mapping = associatorConfiguration['configuration'];
        var associations =
            associators.associationsForComplexMapping(
              associators.complexForSimpleMapping(associations));
        instance.setAssociator(new (associators.SimpleAssociator)());
      } else {
        throw new Error("I do not understand this type of associator.");
      }
    }
  }

  assetServer.use(instance);
}

assetServer.listen(configuration['port'] || 8450);
