<?php

class DatawrapperPlugin_VisualizationMaps extends DatawrapperPlugin_Visualization {

    function __construct() {
        $this->maps           = array();
        $this->maps_as_option = null;
    }

    const HOOK_REGISTER_MAP = 'maps-register-map';

    public function init() {
        $plugin = $this;
        global $app;
        DatawrapperVisualization::register($this, $this->getMeta(), array($this, 'getAssets'));

        // let other plugins add more maps
        DatawrapperHooks::register(self::HOOK_REGISTER_MAP, array($this, 'addMap'));

        // and add the maps included in our own /static/maps/ folder
        foreach (glob(dirname(__FILE__) . "/static/maps/*/map.json") as $file) {
            preg_match("#/static/maps/([^/]+)/map.json#", $file, $m);
            $this->addMap($m[1], 'plugins/' . $this->getName() . '/maps/' . $m[1]);
        }

        // register the map selector dropdown control
        DatawrapperHooks::register(
            DatawrapperHooks::VIS_OPTION_CONTROLS,
            function($o, $k) use ($app, $plugin) {
                $env = array('option' => $o, 'key' => $k);
                $app->render('plugins/' . $plugin->getName() . '/controls.twig', $env);
            }
        );
    }

    public function getMeta() {
        $id = $this->getName();
        return array(
            "id" => "maps",
            "extends" => "raphael-chart",
            "libraries" => array(
                array(
                    "local" => "vendor/kartograph.min.js",
                    "cdn" => "//assets-datawrapper.s3.amazonaws.com/vendor/kartograph-js/0.8.2/kartograph.min.js"
                ),
                array(
                    "local" => "vendor/jquery.qtip.min.js",
                    "cdn" => "//assets-datawrapper.s3.amazonaws.com/vendor/qtip/2.1.1/jquery.qtip.min.js"
                )
            ),
            "title"   => __("Maps", $id),
            "order"   => 92,
            "axes"    => array(
                "keys" => array(
                    "accepts" => array("text", "number"),
                ),
                "color" => array(
                    "accepts" => array("number")
                )
            ),
            "locale" => array(
                "ids-mismatching" => __("A significant fraction of your data (%d) could not be assigned to regions of the chosen map. Please make sure that <ul><li>you have selected the correct map and</li><li>that your dataset uses the same identifiers as used in the map.</li></ul>
                    <p>You may find this <a download='template.csv' href='%t'>template dataset useful</a>.</li></ul>", $id)
            ),
            "hide-base-color-selector" => true,
            "options" => $this->getOptions()
        );
    }

    public function addMap($id, $path) {
        $this->maps[$id] = $path;
        // we need to register the visualization again, as the options have changed
        DatawrapperVisualization::register($this, $this->getMeta(), array($this, 'getAssets'));
    }

    private function getMaps() {
        return $this->maps;
    }

    private function getOptions() {
        $id = $this->getName();
        return array(
            "---map-options---" => array(
                "type" => "separator",
                "label" => __("Select and customize display", $id)
            ),
            "map" => array(
                "type"    => "map-selector",
                "label"   => __("Select map", $id),
                "options" => $this->getMapsAsOption(),
            ),
            "---color-options---" => array(
                "type" => "separator",
                "label" => __("Customize map colors", $id)
            ),
            // NOTE: doesn't working, breaks the chart if used. Nothing else can be changed after.
            "color-column" => array(
                "type" => "select-axis-column",
                "axis" => "color",
                "default" => 0,
                "label" => __("Select data column", $id)
                /*"depends-on" => array(
                    "chart.min_columns[color]" => 2
                )*/
            ),
            "gradient" => array(
                "type" => "color-gradient-selector",
                "label" => __("Color gradient", $id),
                "color-axis" => "color",
                "depends-on" => array(
                    "chart.column_type[color]" => "number"
                )
            ),
            // "category-colors" => array(
            //     "type" => "color-category-selector",
            //     "label" => __("Category colors", $id),
            //     "depends-on" => array(
            //         "chart.column_type[color]" => "text"
            //     ),
            //     "keys" => "color"
            // )
        );
    }

    private function getMapsAsOption() {
        $res = array();
        $locale = substr(DatawrapperSession::getLanguage(), 0, 2);
        foreach ($this->getMaps() as $map_id => $map_path) {
            $label = $map_id;
            $keys  = array();
            $json_file_path = ROOT_PATH . 'www/static/' . $map_path . '/map.json';
            if (file_exists($json_file_path)) {
                $json = json_decode(file_get_contents($json_file_path), true);
                if (!empty($json['title'])) {
                    if (!empty($json['title'][$locale])) {
                        $label = $json['title'][$locale];
                    } elseif (!empty($json['title']['en'])) {
                        $label = $json['title']['en'];
                    }
                }
                $keys = $json['keys'];
            }
            $map_locale = ROOT_PATH . 'www/static/' . $map_path . '/locale.json';
            $res[] = array(
                'value' => $map_id,
                'label' => $label,
                'path' => $map_path,
                'keys' => $keys,
                'has_locale' => file_exists($map_locale)
            );
        }
        return $res;
    }

    /*
     * returns an array of assets (maps in this case) needed
     * to render the visualization on a given chart
     */
    public function getAssets($chart) {
        $map_path = $chart->getMetaData('visualize.map-path');
        $assets   = array(
            $map_path . '/map.svg',
            'plugins/' . $this->getName() . '/stripped.png',
            $map_path . '/map.json'
        );
        $locale_file = $map_path . '/locale.json';
        if (file_exists(ROOT_PATH . 'www/static/' . $locale_file)) {
            $assets[] = $locale_file;
        }
        return $assets;
    }

    public function getDemoDataSets(){
        $id = $this->getName();
        $datasets = array();
        $datasets[] = array(
            'id' => 'unemployment-rate-in-the-european-union',
            'title' => __('Unemployment rate in the European Union', $id),
            'type' => __('Europe Map', $id),
            'presets' => array(
                'type' => 'maps',
                'metadata.describe.intro' => __("The unemployment rate is the percentage of unemployed in the labor force, on the basis of the definition of the International Labour Organization (ILO).", $id),
                'title' => __('Unemployment rate in the European Union', $id),
                'metadata.describe.source-name' => 'Eurostat',
                'metadata.describe.source-url' => 'http://epp.eurostat.ec.europa.eu/tgm/table.do?tab=table&init=1&plugin=1&language=fr&pcode=teilm020',
                'metadata.data.vertical-header' => true,
                'metadata.data.transpose' => false,
                'metadata.visualize.map' => 'europe'
            ),
            'data' => "code ISO;Taux de chomage Janvier 2012\nDE;5,4\nAT;4,8\nBE;8,1\nBG;12,6\nCY;13,6\nDK;7,4\nES;26,4\nEE;9,9\nFI;8\nFR;10,8\nGR;26,7\nHU;11,2\nIE;14,1\nIT;11,7\nLV;\nLT;13,1\nLU;5,4\nMT;6,7\nNL;6\nPL;10,6\nPT;17,5\nCZ;7,1\nRO;6,6\nGB;7,8\nSK;14,5\nSI;9,6\nSE;8"
        );
        return $datasets;
    }
}
