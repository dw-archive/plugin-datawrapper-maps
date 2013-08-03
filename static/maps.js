
(function () {

    // Map
    // -------------------------

    var startsWith = function(str, starts){
      if (starts === '') return true;
      if (str === null || starts === null) return false;
      str = String(str); starts = String(starts);
      return str.length >= starts.length && str.slice(0, starts.length) === starts;
    };


    dw.visualization.register('maps', {

        render: function(el) {
            me = this;
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
            if (me._localized_labels && me._localized_labels[key]) {
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
            if (me.map_meta) return me.map_meta;
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
            var me          = this,
                data        = [],
                keyColumn   = me.axes(true).keys,
                valueColumn = me.axes(true).color;
            _.each(keyColumn.raw(), function (geo_code, index) {
                var value = valueColumn.val(index);
                data[geo_code]  = {};
                data[geo_code].raw   = value;
                data[geo_code].label = me.getLabel(geo_code);
                if (_.isNull(value)) {
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
            var filtered = [];
            _.each(me.map.getLayer('layer0').paths, function(path){
                var key = path.data['key'];
                if (data[key] !== undefined) {
                    filtered[key] = data[key];
                }
            });
            return filtered;
        },

        loadMap: function(el) {
            me.__initCanvas({});
            var $map = $('<div id="map"></div>').html('').appendTo(el);

            // FIXME: set the right size
            me.map = kartograph.map($map);

            // Load all the layers (defined in the map.json)
            me.map.loadMap(me.getSVG(), function(){

                // Loops over layers and adds it into map
                _.each(me.getMapMeta().layers, function(layer, name){
                    layer.name = name;
                    layer.key = 'key';
                    me.map.addLayer(layer.src, layer);
                });

                me.data = me.filterDataWithMapPaths(me.getDataSeries());

                // colorize
                me.scale = eval(me.get('gradient.chromajs-constructor'));
                function fill(path_data) {
                    if (path_data === undefined || (path_data === null)) return false;
                    var data = me.data[path_data['key']];
                    if (data !== undefined) {
                        if (data.raw === null) {
                            color = "url('"+window.vis.meta.__static_path + 'stripped.png'+"')";
                        } else {
                            color = me.scale(data.raw).hex();
                        }
                        me.data[path_data['key']].color = color;
                        return data.color;
                    }
                }
                me.map.getLayer('layer0').style('fill', fill);
                me.map.getLayer('layer0').style('stroke', function(pd) {
                    var color = fill(pd);
                    if (startsWith(color, "url(")) {
                        color = null;
                    }
                    return chroma.hex(fill(color) || '#ccc').darken(25).hex();
                });
                // show scale
                me.showLegend(me.scale);
                // binds mouse events
                me.map.getLayer('layer0').on('mouseenter', me.showTooltip).on('mouseleave', me.hideTooltip);

                me.map.getLayer('layer0').sort(function(pd) {
                    // sort paths by fill lumincane, so darker paths are on top (outline looks better then)
                    var color = fill(pd);
                    if (startsWith(color, "url(")) {
                        color = null;
                    }
                    return chroma.hex(color || '#ccc').luminance() * -1;
                });

                var highlighted = me.get('highlighted-series', []),
                    data = [];

                if (highlighted.length > 0) {
                    me.map.addSymbols({
                        type: $K.HtmlLabel,
                        data: highlighted,
                        location: function(key) { return 'layer0.'+key; },
                        text: function(key) {
                            return me.data[key].label+'<br/>'+me.chart.formatValue(me.data[key].value);
                        },
                        css: function(key) {
                            var fill = chroma.hex(me.data[key].color).luminance() > 0.5 ? '#000' : '#fff';
                            return { color: fill, 'font-size': '13px', 'line-height': '15px' };
                        }
                    });
                    me.map.addLayer('layer0', {
                        name: 'tooltip-target',
                        styles: {
                            stroke: false,
                            fill: '#fff',
                            opacity: 0
                        },
                        add_svg_layer: true
                    });
                    me.map.getLayer('tooltip-target')
                        .on('mouseenter', me.showTooltip)
                        .on('mouseleave', me.hideTooltip);
                }

                // mark visualization as rendered
                me.renderingComplete();

            }, { padding: -2 });
        },

        resizeMap: function(w, h) {
            var me = this;
            if (me.get('scale-mode', 'width') == 'viewport') {
                me.map.resize(w,h);
                $("#map").css({ height:h, width:w });
            } else {
                $('#map').css({ height: me.map.height });
            }
        },

        showLegend: function(scale) {
            // remove old legend
            var me = this;
            $('#chart .scale').remove();
            var domains       = scale.domain(),
                legend_size   = Math.min(Math.max(Math.min(300, me.__w), me.__w*0.6), 500),
                domains_delta = domains[domains.length-1] - domains[0],
                $scale        = $("<div class='scale'></div>"),
                offset        = 0,
                max_height    = 0;

                $scale.css("width", legend_size);

            _.each(domains, function(step, index) {
                // for each segment, we adding a domain in the legend and a sticker
                if (index < domains.length - 1) {
                    var delta = domains[index+1] - step,
                        color = scale(step),
                        size  = delta / domains_delta * legend_size,
                        // setting step
                        $step = $("<div class='step'></div>"),
                        $sticker = $("<span class='sticker'></span>").appendTo($scale);

                    $step.css({width: size, 'background-color': color});
                    // settings ticker
                    $sticker.css('left', offset);
                    if (step.toString().split('.')[1] && step.toString().split('.')[1].length > 2){
                        step = Globalize.format(step, 'n');
                    }
                    if (index > 0) {
                        $('<div />')
                            .addClass('value')
                            .html(me.chart.formatValue(step, true, true))
                            .appendTo($sticker);
                    } else {
                        $sticker.remove();
                    }
                    // add hover effect to highlight regions
                    $step.hover(function(e) {
                        var stepColor = chroma.color($(e.target).css('background-color')).hex();
                        function o(pd) {
                            return me.data[pd.key] && me.data[pd.key].color == stepColor ? 1 : 0.1;
                        }
                        me.map.getLayer('bg').style('opacity', o);
                        me.map.getLayer('layer0').style('opacity', o);
                    }, function() {
                        me.map.getLayer('layer0').style('opacity', 1);
                        me.map.getLayer('bg').style('opacity', 1);
                    });
                    $scale.append($step);
                    offset += size;
                }
            });
            // title
            var $title = $("<div class=\"scale_title\"></div>").html(me.dataset.column(1).name());
            // showing the legend
            $('#map').after($scale);
            $scale.prepend($title);
            me.resizeMap(me.__w, me.__h - $scale.outerHeight(true));
        },

        getStickersMaxWidth: function ($scale) {
            var max = 0;
            _.each($scale.find('.sticker'), function (sticker) {
                max = Math.max(max, $(sticker).outerWidth(false));
            });
            return max;
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
        },

        keys: function() {
            var me = this;
            return me.axes(true).keys.values();
        }

    });

}).call(this);