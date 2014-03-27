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
                $app->render('plugins/' . $plugin->getName() . '/map-selector.twig', $env);
            }
        );

        $this->declareAssets(array(
            'sync-map-selector.js'
        ), "|/chart/[^/]+/visualize|");
    }

    public function getMeta() {
        $id = $this->getName();
        $cdn_url = $GLOBALS['dw_config']['cdn_asset_base_url'];
        return array(
            "id" => "maps",
            "extends" => "raphael-chart",
            "libraries" => array(
                array(
                    "local" => "vendor/kartograph.js",
                    "cdn" => !empty($cdn_url)
                        ? $cdn_url . "vendor/kartograph-js/0.8.5/kartograph.min.js"
                        : null
                ),
                array(
                    "local" => "vendor/jquery.qtip.min.js",
                    "cdn" => !empty($cdn_url)
                        ? $cdn_url . "vendor/qtip/2.1.1/jquery.qtip.min.js"
                        : null
                )
            ),
            "title"   => __("Map", $id).' (beta)',
            "order"   => 92,
            "axes"    => array(
                "keys" => array(
                    "title" => __("Key"),
                    "accepts" => array("text", "number"),
                ),
                "color" => array(
                    "title" => __("Color"),
                    "accepts" => array("number", "text")
                ),
                "tooltip" => array(
                    "title" => __("Tooltip"),
                    "multiple" => true,
                    "optional" => true,
                    "accepts" => array("text", "number", "date")
                )
            ),
            "locale" => array(
                "ids-mismatching" => __("A significant fraction of your data (%d) could not be assigned to regions of the chosen map. Please make sure that <ul><li>you have selected the correct map and</li><li>that your dataset uses the same identifiers as used in the map.</li></ul>
                    <p>You may find this <a download='template.csv' href='%t'>template dataset useful</a>.</li></ul>", $id)
            ),
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
                "label" => __("Configure the map", $id)
            ),

            "map" => array(
                "type"    => "map-selector",
                "label"   => __("Base map", $id),
                "options" => $this->getMapsAsOption()
            ),

            "map-keys" => array(
                "type" => "select-axis-column",
                "axes" => array(array(
                    "id" => "keys",
                    "label" => __("Map key column")
                )),
                "help" => __("Please select the column which contains the <b>map region keys</b>.")
            ),

            "map-data" => array(
                "type" => "select-axis-column",
                "axes" => array(array(
                    "id" => "color",
                    "label" => __("Data column")
                )),
                "help" => __("Please select the data columns that contain the <b>data values</b> to be displayed in the map.")
            ),

            "gradient" => array(
                "type" => "color-gradient-selector",
                "label" => __("Color gradient", $id),
                "color-axis" => "color",
                "depends-on" => array(
                    "chart.column_type[color]" => "number"
                ),
                "use-classes" => true,
                "help" => __("Here you can define a <b>color gradient</b> from which map colors are picked according to the <b>classification</b>.")
            ),
            "category-colors" => array(
                "type" => "color-category-selector",
                "label" => __("Category colors", $id),
                "depends-on" => array(
                    "chart.column_type[color]" => "text"
                ),
                "keys" => "color",
                "help" => __("Here you can select a palette from which the category colors are picked. On top of that you can assign custom colors for each category.")
            )
            // "---other-options---" => array(
            //     "type" => "separator",
            //     "label" => __("Map scaling", $id)
            // ),
            // "fit-into-chart" => array(
            //     "type" => "checkbox",
            //     "label" => __("Fit map into chart size"),
            //     "default" => false,
            //     "help" => __("If selected, the map will be scaled to fit the chart size. Otherwise it will always use the full chart width.")

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

}
