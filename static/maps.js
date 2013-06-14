
(function(){

    // Map
    // -------------------------

    var Map = Datawrapper.Visualizations.Map = function() {

    };

    _.extend(Map.prototype, Datawrapper.Visualizations.Base, {

        getSVG: function() {
            throw "getSVG: implement me";
        },

        getStyle: function() {
            return {};
        },

        loadMap: function(el) {
            el = $(el);
            var c = me.initCanvas({});
            me.initDataSeries(); // set me.data
            me.map_meta = this.meta['map'];
            var $map    = $('<div id="map"></div>');
            me.map      = Kartograph.map($map, me.__w, me.__h);
            me.map.loadMap(me.getSVG(), function(){
                me.map.addLayer(me.map_meta['layer'], {
                    styles: me.getStyle()
                    // NOTE: native tooltip. Disabled since we use custom tooltip
                    // title: function(data) {return data[me.map_meta['label']];}
                });
                // set label in data
                _.each(me.map.getLayer(me.map_meta['layer']).paths, function(path){
                    if (me.data[path.data[me.map_meta['key']]] !== undefined) {
                        me.data[path.data[me.map_meta['key']]].label = path.data[me.map_meta['label']];
                    }
                });
                // colorize
                var custom_color = me.get('custom-colors', {});
                if (custom_color[me.chart.dataSeries()[0].name])
                    var base_color = custom_color[me.chart.dataSeries()[0].name];
                else
                    var base_color = me.theme.colors.palette[me.get('base-color', 0)];
                var scale     = chroma.scale([chroma.color(base_color).darken(-75), base_color]).domain(me.chart.dataSeries()[0].data, 5, 'e');
                me.map.getLayer(me.map_meta['layer']).style('fill', function(data) {
                    var meta = me.data[data[me.map_meta['key']]];
                    if (meta !== undefined) {
                        if (meta.raw == "n/a") {
                            var color = "#CECECE";
                        } else {
                            var color = scale(meta.raw).hex();
                        }
                        me.data[data[me.map_meta['key']]].color = color;
                        return meta.color;
                    }
                });
                // show scale
                me.showScale(scale);
                // binds mouse events
                me.map.getLayer(me.map_meta['layer']).on('mouseenter', me.showTooltip).on('mouseleave', me.hideTooltip);
            });
            el.append($map);
        },

        resizeMap: function(w, h) {
            me.map.resize(w,h);
            $("#map").css({height:h, width:w});
        },

        showScale: function(scale) {
            if (!me.get('show-legend')) {return false;}
            var legend = {
                position : me.get('legend-position', 'vertical')
            };
            var domains = scale.domain();
            var $scale      = $("<div class='scale'></div>");
            var $scale_list = $("<ul></ul>");
            domains.every(function(domain, i) {
                if (domains.length <= i+1) {return false;}
                var label  = me.chart.get('metadata.describe.number-prepend', '');
                label     += domain.toFixed(2)+" - "+domains[i+1].toFixed(2);
                label     += me.chart.get('metadata.describe.number-append', '');
                var color  = scale(domain);
                $scale_list.append("<li><div class=\"scale_color\" style=\"background-color:"+color+"\"></div><span>"+label+"</span></li>");
                return true;
            });
            $scale.append($scale_list);
            $('#map').after($scale);

            if (legend.position == "vertical") {
                $scale.addClass("vertical").css('padding-top', $('#map').height() - $scale.outerHeight(true));
                $('#map').css("float", "left");
                me.resizeMap(me.__w - $scale_list.outerWidth(false), me.__h);
            } else if (legend.position == "horizontal") {
                $scale.addClass("horizontal");
                me.resizeMap(me.__w, me.__h - $scale.outerHeight(true));
            }
        },

        showTooltip: function(data, path, event) {
            if (me.data[data[me.map_meta['key']]] === undefined) {return;}
            var $tooltip = $("<div class='tooltip'></div>");
            // set title
            $title = $("<h2></h2>").text(me.data[data[me.map_meta['key']]].label);
            $tooltip.append($title);
            // set value
            $value = $("<div></div>").text(me.data[data[me.map_meta['key']]].value);
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
        
        /**
         * 
         *
         * @return {Array} Generated data
         */
        initDataSeries: function() {
            me.data = new Array();
            _.each(me.chart.dataSeries()[0].data, function(value, s) {
                var geo_code = me.chart.rowLabels()[s];
                me.data[geo_code]       = {};
                me.data[geo_code].raw   = value;
                if (Number(value) == value)
                    me.data[geo_code].value = me.chart.formatValue(value, true);
                else
                    me.data[geo_code].value = me.chart.formatValue(value, false);
            });
            return me.data;
        },

        initCanvas: function(canvas) {
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