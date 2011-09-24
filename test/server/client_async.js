var modules = [];
satisfyModule = function (n) {
  modules.push(n);
  modules.sort();
  console.log(modules.join(','))
};
require('/order/1', function () {});
