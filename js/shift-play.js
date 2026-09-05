/* The Shift — play loop entry.
 * Loads hand flow / glance / shift-end RC quiz (sp-0…sp-9 + join).
 * Requires shift-floor.js (or sf packs) first.
 */
(function () {
  var script = document.currentScript;
  var dir = script && script.src ? script.src.replace(/[^/]+$/, '') : 'js/';
  var files = [
    'sp-0.js', 'sp-1.js', 'sp-2.js', 'sp-3.js', 'sp-4.js',
    'sp-5.js', 'sp-6.js', 'sp-7.js', 'sp-8.js', 'sp-9.js', 'sp-join.js'
  ];
  for (var i = 0; i < files.length; i++) {
    document.write('<script src="' + dir + files[i] + '"><\\/script>');
  }
})();
