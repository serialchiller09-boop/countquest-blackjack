/* The Shift — floor module entry.
 * Loads mid-shoe setup/render/ambient (sf-0…sf-8 + join).
 */
(function () {
  var script = document.currentScript;
  var dir = script && script.src ? script.src.replace(/[^/]+$/, '') : 'js/';
  var files = [
    'sf-0.js', 'sf-1.js', 'sf-2.js', 'sf-3.js', 'sf-4.js',
    'sf-5.js', 'sf-6.js', 'sf-7.js', 'sf-8.js', 'sf-join.js'
  ];
  for (var i = 0; i < files.length; i++) {
    document.write('<script src="' + dir + files[i] + '"></script>');
  }
})();
