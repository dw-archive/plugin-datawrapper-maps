
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
                    url: window.vis.meta.__static_path + 'maps/' + me.get('map') + "/locale/" + me.chart.locale().replace('-', '_') +".json",
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

        /**
        * Can be overwrited. This function return the data as:
        * Array(geo_code_as_key => {raw:, value:})
        * value is the raw formated.
        * @return {Array} 
        */
        getDataSeries: function() {
            var data = new Array();
            me.dataset.column(0).each(function (geo_code, index) {
                var value = me.dataset.column(1).val(index);
                data[geo_code]  = {};
                data[geo_code].raw   = value;
                data[geo_code].label = me.getLabel(geo_code);
                if (value == null) {
                    data[geo_code].value = "n/a";
                } else {
                    data[geo_code].value = me.chart.formatValue(value, true);
                }
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
                if (custom_color[me.dataset.column(0).name()])
                    var base_color = custom_color[me.chart.dataSeries()[0].name];
                else
                    var base_color = me.theme.colors.palette[me.get('base-color', 0)];
                me.scale = chroma.scale([chroma.color(base_color).darken(-75), base_color]).out('hex');
                me.scale.domain(me.getBreaks(me.dataset.column(1).values()));
                me.map.getLayer('layer0').style('fill', function(path_data) {
                    var data = me.data[path_data['key']];
                    if (data !== undefined) {
                        if (data.raw == null) {
                            var color = "#CECECE";
                        } else {
                            var color = me.scale(data.raw);
                        }
                        me.data[path_data['key']].color = color;
                        return data.color;
                    }
                });

                // show scale
                me.showLegend(me.scale);
                // binds mouse events
                me.map.getLayer('layer0').on('mouseenter', me.showTooltip).on('mouseleave', me.hideTooltip);
            });
            el.append($map);
        },

        resizeMap: function(w, h) {
            me.map.resize(w,h);
            $("#map").css({height:h, width:w});
        },

        getBreaks: function(data) {
            var break_type     = me.get('breaks', 'equidistant');
            var number_classes = me.get('classes', 5);
            if (break_type == "equidistant") {
                return chroma.limits(data, 'e', number_classes);
            } else if (break_type == "equidistant-rounded") {
                return chroma.limits(data, 'e', number_classes).map(Math.round);
            } else if (break_type == "nice") {
                return d3.scale.linear().domain(data).nice().ticks(number_classes);
            }
        },

        showLegend: function(scale) {
            var domains       = scale.domain();
            var legend_size   = me.get('legend-position', 'vertical') == 'vertical' ? me.__h/2 : me.__w/2;
            var domains_delta = domains[domains.length-1] - domains[0];
            var $scale        = $("<div class='scale'></div>");
            $scale.addClass(me.get('legend-position', 'vertical'));
            var orientation   = me.get('legend-position', 'vertical') == 'vertical' ? 'height' : 'width';
            $scale.css(orientation, legend_size);
            var offset = 0;
            _.each(domains, function(step, index) {
                // for each segment, we adding a domain in the legend and a sticker
                if (index < domains.length - 1 ) {
                    var delta = domains[index+1] - step;
                    var color = scale(step);
                    var size  = delta / domains_delta * legend_size;
                    // setting step
                    var $step = $("<div class='step'></div>");
                    var opt          = {'background-color' : color};
                    opt[orientation] = size;
                    $step.css(opt);
                    // settings ticker
                    var $sticker = $("<span class='sticker'></span>");
                    $sticker.css(me.get('legend-position', 'vertical') == 'vertical' ? 'bottom' : 'left', offset);
                    if (step.toString().split('.')[1] && step.toString().split('.')[1].length > 2){
                        step = Globalize.format(step, 'n');
                    }
                    $sticker.html(me.chart.formatValue(step, true, true));
                    $scale[me.get('legend-position', 'vertical') == 'vertical' ? 'prepend' : 'append']($step);
                    $scale.append($sticker);
                    offset += size;
                }
            });
            // showing the legend
            $('#map').after($scale);
            if (me.get('legend-position', 'vertical') == 'vertical') {
                $('#map').css("float", "left");
                $scale.css('padding-top', $('#map').height()/2 - $scale.outerHeight(true)/2);
                me.resizeMap(me.__w - $scale.outerWidth(true), me.__h);
            } else {
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