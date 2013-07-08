
(function(){

    // Map
    // -------------------------

    var startsWith = function(str, starts){
      if (starts === '') return true;
      if (str == null || starts == null) return false;
      str = String(str); starts = String(starts);
      return str.length >= starts.length && str.slice(0, starts.length) === starts;
    };

    var Maps = Datawrapper.Visualizations.Maps = function() {};

    _.extend(Maps.prototype, Datawrapper.Visualizations.Base, {

        render: function(el) {
            el = $(el); me = this;
            me.loadMap(el);
        },

        /**
        * Return the path for svg file.
        */
        getSVG: function() {
            return window.vis.meta.__static_path + 'maps/' + me.get('map') + "/map.svg";
        },

        /**
        * Return the label for the given path key.
        * If the translation doens't exist in the <map>/locale/<lang>.json file,
        * The label is retrieved in the svg file at the 'data-label' field.
        */
        getLabel: function(key) {
            if (me._localized_labels === undefined) {
                var res = $.ajax({
                    url: window.vis.meta.__static_path + 'maps/' + me.get('map') + "/locale/" + me.chart.locale.replace('-', '_') +".json",
                    async: false,
                    dataType: 'json'
                });
                me._localized_labels = (res.status == 200) ? eval('(' + res.responseText + ')') : null;
            }
            if (me._localized_labels != undefined && me._localized_labels[key] != undefined) {
                return me._localized_labels[key];
            }
            var path = me.map.getLayer('layer0').getPaths({"key":key.toString()});
            if (path.length > 0) {
                return me.map.getLayer('layer0').getPaths({key:key.toString()})[0].data.label;    
            }
            return "";
        },

        /**
        * Parse and return the map's json
        */
        getMapMeta: function() {
            if (me.map_meta != undefined) return me.map_meta;
            var res = $.ajax({
                url: window.vis.meta.__static_path + 'maps/' + me.get('map') + "/map.json",
                async: false,
                dataType: 'json'
            });
            var meta = eval('(' + res.responseText + ')');
            me.map_meta = meta;
            return meta;
        },

        /** Map style, Can be overwrited */
        getStyle: function() {
            return {};
        },

        /**
        * Can be overwrited. This function return the data as:
        * Array(geo_code_as_key => {raw:, value:})
        * value is the raw formated.
        * @return {Array} 
        */
        getDataSeries: function() {
            var data = new Array();
            _.each(me.chart.dataSeries()[0].data, function(value, s) {
                var geo_code = me.chart.rowLabels()[s];
                data[geo_code]     = {};
                data[geo_code].raw = value;
                data[geo_code].label = me.getLabel(me.chart.rowLabels()[s]);
                if (Number(value) == value)
                    data[geo_code].value = me.chart.formatValue(value, true);
                else
                    data[geo_code].value = me.chart.formatValue(value, false);
            });
            return data;
        },

        /**
        * Loops into svg's paths, filter the given data to
        * keep only related data.
        * @return {Array} 
        */
        filterDataWithMapPaths: function(data) {
            var filtered = Array();
            _.each(me.map.getLayer('layer0').paths, function(path){
                var key = path.data['key'];
                if (data[key] !== undefined) {
                    filtered[key] = data[key];
                }
            });
            return filtered;
        },

        loadMap: function(el) {
            el = $(el);
            me.__initCanvas({});
            var $map = $('<div id="map"></div>');

            // FIXME: set the right size
            me.map = Kartograph.map($map, me.__w, me.__h);

            // Load all the layers (defined in the map.json)
            me.map.loadMap(me.getSVG(), function(){

                // Loops over layers and adds it into map
                _.each(me.getMapMeta().layers, function(layer){
                    me.map.addLayer(layer.id, {styles: layer.style});
                });

                me.data = me.filterDataWithMapPaths(me.getDataSeries());

                // colorize
                // set base color (from custom color if defined)
                var custom_color = me.get('custom-colors', {});
                if (custom_color[me.chart.dataSeries()[0].name])
                    var base_color = custom_color[me.chart.dataSeries()[0].name];
                else
                    var base_color = me.theme.colors.palette[me.get('base-color', 0)];
                me.scale = me.getScale(me.chart.dataSeries()[0].data, base_color);

                me.map.getLayer('layer0').style('fill', function(path_data) {
                    var data = me.data[path_data['key']];
                    if (data !== undefined) {
                        if (data.raw == "n/a") {
                            var color = "#CECECE";
                        } else {
                            var color = me.scale(data.raw).hex();
                        }
                        me.data[path_data['key']].color = color;
                        return data.color;
                    }
                });

                // show scale
                me.showScale(me.scale);
                // binds mouse events
                me.map.getLayer('layer0').on('mouseenter', me.showTooltip).on('mouseleave', me.hideTooltip);
            });
            el.append($map);
        },

        resizeMap: function(w, h) {
            me.map.resize(w,h);
            $("#map").css({height:h, width:w});
        },

        getScale: function(data, base_color) {
            return chroma.scale([chroma.color(base_color).darken(-75), base_color]).domain(data, 5, 'e');
        },

        showScale: function(scale) {
            var legend = {
                position : me.get('legend-position', 'vertical')
            };
            var domains = scale.domain();
            var $scale      = $("<div class='scale'></div>");
            domains.every(function(domain, i) {
                if (domains.length <= i+1) {return false;}
                var label  = me.chart.get('metadata.describe.number-prepend', '');
                label     += domain.toFixed(0);
                label     += me.chart.get('metadata.describe.number-append', '');
                var color  = scale(domain);
                $scale.append("<div style=\"background-color:"+color+"\">> "+label+"</div>");
                return true;
            });
            $('#map').after($scale);
            if (legend.position == "vertical") {
                $scale.addClass("vertical").css('padding-top', $('#map').height()/2 - $scale.outerHeight(true)/2);
                $('#map').css("float", "left");
                me.resizeMap(me.__w - $scale.outerWidth(true), me.__h);
            } else if (legend.position == "horizontal") {
                $scale.addClass("horizontal");
                me.resizeMap(me.__w, me.__h - $scale.outerHeight(true));
            }
        },

        showTooltip: function(data, path, event) {
            if (me.data[data['key']] === undefined) {return;}
            var $tooltip = $("<div class='tooltip'></div>");
            // set title
            $title = $("<h2></h2>").text(me.data[data['key']].label);
            $tooltip.append($title);
            // set value
            $value = $("<div></div>").text(me.data[data['key']].value);
            $tooltip.append($value);
            // show
            $('#chart').append($tooltip);
            $(document).bind('mousemove', function(event){
                var offsetX = event.pageX;
                var offsetY = event.pageY;
                // place tooltip horizontaly
                if(me.__w < offsetX + $tooltip.outerWidth(true)) {
                    offsetX -= $tooltip.outerWidth(true);
                }
                // place tooltip verticaly
                if(me.__h < offsetY + $tooltip.outerHeight(true)) {
                    offsetY -= $tooltip.outerHeight(true);
                }
                $tooltip.css({"top": offsetY, "left":offsetX});
            });
        },

        hideTooltip: function(data, path, event) {
            $('#chart').find('.tooltip').remove();
        },

        __initCanvas: function(canvas) {
            var me = this;
            canvas = _.extend({
                w: me.__w,
                h: me.__h,
                rpad: me.theme.padding.right,
                lpad: me.theme.padding.left,
                bpad: me.theme.padding.bottom,
                tpad: me.theme.padding.top
            }, canvas);
            me.__canvas = canvas;
            return canvas;
        },

        __urlExists: function(url) {
            var http = new XMLHttpRequest();
            http.open('HEAD', url, false);
            http.send();
            return http.status!=404;
        }
    });

}).call(this);