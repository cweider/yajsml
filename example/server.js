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

var connect = require('connect');
var cors = require('connect-cors');

var UglifyMiddleware = require('./uglify-middleware');
var compressor = new UglifyMiddleware();
compressor._console = console;

var Yajsml = require('../server');
var SimpleAssociator = require('../associator').SimpleAssociator;

var yajsml_local = new (Yajsml.Server)({
  rootURI: 'file://' + __dirname + '/public/javascripts/src'
, rootPath: 'javascripts/src'
, libraryURI: 'file://' + __dirname + '/public/javascripts/lib'
, libraryPath: 'javascripts/lib'
});
yajsml_local.setAssociator(new SimpleAssociator());

var instances_controller = new (require('./instances_controller'))

var admin_web = connect.createServer()
    .use(connect.cookieParser())
    .use(connect.limit('500kb'))
    .use(compressor)
    .use(connect.favicon(__dirname + '/public/images/favicon.ico'))
    .use(connect.router(function(app) {
      app.get('/instances', function(req, res, next) {
        instances_controller.index(req, res);
      });
      app.post('/instances', function(req, res, next) {
        instances_controller.create(req, res);
      });
      app.get('/instances/:id', function(req, res, next) {
        instances_controller.show(req, res);
      });
      app.put('/instances/:id', function(req, res, next) {
        instances_controller.update(req, res);
      });
      app.delete('/instances/:id', function(req, res, next) {
        instances_controller.destroy(req, res);
      });
    }))
    .use(yajsml_local)
    .use(connect.static(__dirname + '/public'))
    .listen(8450);

var admin_assets = connect.createServer()
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
  .use(compressor)
  .use(yajsml_local)
  .listen(8451);
