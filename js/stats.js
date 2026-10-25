(function () {
  var p = location.pathname;
  var x = new XMLHttpRequest();
  x.open("GET", "/stats?p=" + encodeURIComponent(p), true);
  x.timeout = 6000;
  x.onload = function () {
    try {
      var d = JSON.parse(x.responseText);
      var set = function (id, v) {
        var e = document.getElementById(id);
        if (e) e.textContent = v;
      };
      set("busuanzi_value_site_uv", d.site_uv);
      set("busuanzi_value_site_pv", d.site_pv);
      set("busuanzi_value_page_pv", d.page_pv);
    } catch (e) {}
  };
  x.send();
})();
