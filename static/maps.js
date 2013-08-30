
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
            var me = this;
            if (me.map && me.get('map') == me.__lastSVG) {
                // it's enough to update the map
                me.updateMap();
                me.renderingComplete();
            } else {
                if (me.map) me._reset();
                me.loadMap(el);
            }
        },

        reset: function() {
            // we override reset() with an empty function because we
            // want to decide ourself whether or not we want to reset the map
        },

        _reset: function() {
            // this is called by our own render() function
            var me = this;
            me.map.clear();
            $('#chart').html('').off('click').off('mousemove').off('mouseenter').off('mouseover');
            $('.chart .filter-ui').remove();
            $('.chart .legend').remove();
        },

        /**
        * Return the path for svg file.
        */
        getSVG: function() {
            var me = this;
            return 'assets/' + me.get('map-path') + "/map.svg";
        },

        /*
         * called by render() whenever a new map needs to be loaded
         */
        loadMap: function(el) {
            var me = this,
                c = me.__initCanvas({});
                $map = $('<div id="map"></div>').html('').appendTo(el);

            /**
            * Parse and return the map's json
            */
            function getMapMeta() {
                if (me.map_meta) return me.map_meta;
                var res = $.ajax({
                    url: 'assets/' + me.get('map-path') + "/map.json",
                    async: false,
                    dataType: 'json'
                });
                var meta = eval('(' + res.responseText + ')');
                me.map_meta = meta;
                return meta;
            }

            // FIXME: set the right size
            me.map = kartograph.map($map, c.w-10);
            me.__lastSVG = me.get('map');

            // Load all the layers (defined in the map.json)
            me.map.loadMap(me.getSVG(), function(){

                // Loops over layers and adds it into map
                _.each(getMapMeta().layers, function(layer, name){
                    layer.name = name;
                    layer.key = 'key';
                    me.map.addLayer(layer.src, layer);
                });

                me.updateMap();

                // binds mouse events
                me.map.getLayer('layer0').on('mouseenter', _.bind(me.showTooltip, me)).on('mouseleave', me.hideTooltip);

                // mark visualization as rendered
                me.renderingComplete();

            }, { padding: 2 });
        },

        /*
         * called by render() whenever only the map config changed
         */
        updateMap: function() {
            var me = this;

            // resize map
            me.data = getData();

            // colorize
            me.scale = eval(me.get('gradient.chromajs-constructor'));
            function fill(path_data) {
                if (path_data === undefined || (path_data === null)) return false;
                var data = me.data[path_data['key']];
                if (data !== undefined) {
                    if (data.raw === null) {
                        color = "url('"+window.vis.meta.__static_path + 'stripped.png'+"')";
                    } else {
                        // BUG in chroma.js, me.scale() returns undefined
                        color =me.scale(data.raw) ? me.scale(data.raw).hex() : '#000';
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
                        return me.data[key].label+'<br/>'+me.formatValue(me.data[key].value, true);
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
                    .on('mouseenter', _.bind(me.showTooltip, me))
                    .on('mouseleave', _.bind(me.hideTooltip, me));

                me.resizeMap(me.__w, me.__h - $('.scale').outerHeight(true));
            }

            /*
             * Loops into svg's paths, filter the given data to
             * keep only related data.
             * @return {Array}
             */
            function getData() {
                var data = getDataSeries(),
                    filtered = {},
                    paths = me.map.getLayer('layer0').paths,
                    pathIDs = [],
                    found = 0;
                _.each(paths, function(path){
                    var key = path.data['key'];
                    pathIDs.push(key);
                    if (data[key] !== undefined) {
                        filtered[key] = data[key];
                        found++;
                    }
                });
                var missing_percent = 1 - found / _.keys(data).length;
                if (missing_percent > 0.2 && !me.__didAlreadyNotify) {
                    me.__didAlreadyNotify = true;
                    var template_ds = dw.dataset([
                            dw.column('ID', pathIDs, 'text'),
                            dw.column('Label', _.map(pathIDs, function(k) {
                                return getLabel(k);
                            }), 'text'),
                            dw.column('Value', _.times(pathIDs.length, function() {
                                return _.random(0, Math.random() < 0.2 ? 1000 : 500);
                            }), 'number')
                        ]),
                        template_csv = 'data:application/octet-stream;charset=utf-8,' +
                        encodeURIComponent(template_ds.toCSV());
                    me.notify(
                        me.translate("ids-mismatching")
                          .replace("%d", (missing_percent*100).toFixed(0)+'%')
                          .replace("%t", template_csv)
                    );
                }
                return filtered;
            }

            /*
             * Return the label for the given path key.
             * If the translation doens't exist in the <map>/locale/<lang>.json file,
             * The label is retrieved in the svg file at the 'data-label' field.
             */
            function getLabel(key) {
                if (me._localized_labels === undefined) {
                    var res = $.ajax({
                        url: 'assets/' + me.get('map-path') + "/locale/" + me.chart().locale().replace('-', '_') +".json",
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
            }

            /*
             * This function return the data as:
             * Array(geo_code_as_key => {raw:, value:})
             * value is the raw formated.
             * @return {Array}
             */
            function getDataSeries() {
                var data        = {},
                    keyColumn   = me.axes(true).keys,
                    valueColumn = me.axes(true).color;
                _.each(keyColumn.raw(), function (geo_code, index) {
                    var value = valueColumn.val(index);
                    data[geo_code]  = {};
                    data[geo_code].raw   = value;
                    data[geo_code].label = getLabel(geo_code);
                    if (_.isNull(value)) {
                        data[geo_code].value = "n/a";
                    } else {
                        data[geo_code].value = me.formatValue(value, true);
                    }
                });
                return data;
            }

        }, // end updateMap

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
                $legend       = $("<div class='scale'></div>"),
                offset        = 0,
                max_height    = 0;

            $legend.css("width", legend_size);

            _.each(domains, function(step, index) {
                // for each segment, we adding a domain in the legend and a sticker
                if (index < domains.length - 1) {
                    var delta = domains[index+1] - step,
                        color = scale(step),
                        size  = delta / domains_delta * legend_size,
                        // setting step
                        $step = $("<div class='step'></div>"),
                        $sticker = $("<span class='sticker'></span>").appendTo($legend);

                    $step.css({width: size, 'background-color': color});
                    // settings ticker
                    $sticker.css('left', offset);
                    if (step.toString().split('.')[1] && step.toString().split('.')[1].length > 2){
                        step = Globalize.format(step, 'n');
                    }
                    if (index > 0) {
                        $('<div />')
                            .addClass('value')
                            .html(me.formatValue(step, index == domains.length-2, true))
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
                    $legend.append($step);
                    offset += size;
                }
            });
            // title
            $("<div />")
                .addClass('scale_title')
                .html(me.dataset.column(1).title())
                .prependTo($legend);
            // showing the legend
            $('#map').after($legend);

            me.resizeMap(me.__w, me.__h - $legend.outerHeight(true));
        },

        getStickersMaxWidth: function ($scale) {
            var max = 0;
            _.each($scale.find('.sticker'), function (sticker) {
                max = Math.max(max, $(sticker).outerWidth(false));
            });
            return max;
        },

        showTooltip: function(data, path, event) {
            var me = this;
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
                rpad: me.theme().padding.right,
                lpad: me.theme().padding.left,
                bpad: me.theme().padding.bottom,
                tpad: me.theme().padding.top
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
        },

        formatValue: function() {
            var me = this;
            // we're overwriting this function with the actual column formatter
            // when it is first called (lazy evaluation)
            me.formatValue = me.chart().columnFormatter(me.axes(true).color);
            return me.formatValue.apply(me, arguments);
        },

        // tell the template that we are smart enough to re-render the map
        supportsSmartRendering: function() {
            return true;
        }

    });

}).call(this);