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

var Uglify = require('uglify-js');

module.exports = function (options) {
  function uglifyHandler(req, res, next) {
    var old_res = {};
    old_res.writeHead = res.writeHead;
    
    res.writeHead = function (status, headers) {
console.error('HEAD');
console.error(headers);
      if (headers && headers['Content-Type'] == 'application/javascript') {
        var buffer = '';

        old_res.write = res.write;
        old_res.end = res.end;
        res.write = function(data, encoding) {
console.error('chunk')
          buffer += data.toString(encoding);
        };
        res.end = function(data, encoding) {
          if (data) {
            res.write(data, encoding);
          }

          var content = undefined;
          try {
            var ast = Uglify.jsp.parse(buffer);
            ast = pro.ast_mangle(ast);
            ast = pro.ast_squeeze(ast);
            content = pro.gen_code(ast);
          } catch (e) {
            // Silence error?
            content = buffer;
          }

          res.write = old_res.write;
          res.end = old_res.end;
console.error(content);
          res.write(content, 'utf8');
          res.end();
        };
      }

      res.writeHead = old_res.writeHead;
      res.writeHead(status, headers);
    };

    next();
  };
  return uglifyHandler;
};
