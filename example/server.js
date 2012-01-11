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

var Connect = require('connect');
var CORS = require('connect-cors');

var UglifyMiddleware = require('./uglify-middleware');
var compressor = new UglifyMiddleware();

var Yajsml = require('../server');
var server = new (Yajsml.Server)({
  rootURI: 'file://' + __dirname + '/static/javascripts/src'
, rootPath: 'javascripts/src'
, libraryURI: 'file://' + __dirname + '/static/javascripts/lib'
, libraryPath: 'javascripts/lib'
});

Connect.createServer(
  CORS({
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
    })
, Connect.cookieParser()
, compressor
, server
).listen(3000);
