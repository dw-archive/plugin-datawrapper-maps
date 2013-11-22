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

        DatawrapperHooks::register(DatawrapperHooks::GET_DEMO_DATASETS, array($this, 'getDemoDataSets'));
    }

    public function getMeta() {
        $id = $this->getName();
        return array(
            "id" => "maps",
            "extends" => "raphael-chart",
            "libraries" => array(
                array(
                    "local" => "vendor/kartograph.min.js",
                    "cdn" => "//assets-datawrapper.s3.amazonaws.com/vendor/kartograph-js/0.8.3/kartograph.min.js"
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

    public function getDemoDataSets() {
        return array(
            'id' => 'some-country-metrics',
            'title' => __('Some Country Metrics'),
            'type' => __('Map'),
            'presets' => array(
                'type' => 'maps',
                'title' => __('Some country metrics'),
                'metadata.describe.source-name' => 'World Bank',
                'metadata.describe.source-url' => 'http://data.worldbank.org/',
                'metadata.data.vertical-header' => true,
                'metadata.data.transpose' => false,
                'metadata.visualize.map' => '1-world'
            ),
            'data' => "iso3,continent,urban_population_2010,fertility_rate_births_per_woman_2010,primary_school_enrollment_2010,internet_user_2010\nAND,EU,87.817,1.22,101.7729,81.0\nARE,AS,84.042,1.868,,68.0\nAFG,AS,23.239,5.659,,4.0\nATG,NA,29.882,2.13,82.44175,80.0\nALB,EU,52.322,1.741,55.6671,45.0\nARM,AS,64.066,1.738,31.14385,25.0\nAGO,AF,58.379,6.218,104.40369,10.0\nATA,AN,,,,\nARG,SA,92.349,2.215,75.00013,45.0\nASM,OC,92.978,,,\nAUT,EU,67.454,1.44,99.61602,75.17\nAUS,OC,89.046,1.87,78.41685,76.0\nABW,NA,46.777,1.701,112.04627,62.0\nALA,EU,,,,\nAZE,AS,53.401,1.92,25.58294,46.0\nBIH,EU,47.733,1.242,16.74964,52.0\nBRB,NA,43.889,1.839,107.60689,70.2\nBGD,AS,27.894,2.277,13.4249,3.7\nBEL,EU,97.456,1.84,119.2369,75.0\nBFA,AF,25.667,5.869,2.71606,2.4\nBGR,EU,72.524,1.49,79.44238,46.23\nBHR,AS,88.618,2.142,,55.0\nBDI,AF,10.642,6.304,8.74854,1.0\nBEN,AF,44.258,5.095,18.16134,3.13\nBMU,NA,100.0,1.764,44.625,84.21\nBRN,AS,75.597,2.051,88.09107,53.0\nBOL,SA,66.399,3.357,45.57935,22.4\nBRA,SA,84.335,1.838,,40.65\nBHS,NA,84.064,1.901,,43.0\nBTN,AS,34.793,2.375,2.28138,13.6\nBWA,AF,60.977,2.761,,6.0\nBLR,EU,74.615,1.44,99.47924,31.8\nBLZ,NA,44.963,2.801,46.0872,14.0\nCAN,NA,80.554,1.6269,,80.3\nCOD,AF,33.727,6.251,3.3288,0.72\nCAF,AF,38.849,4.626,,2.0\nCOG,AF,63.223,5.072,12.53178,5.0\nCHE,EU,73.638,1.52,99.23283,83.9\nCIV,AF,50.557,4.91,,2.1\nCHL,SA,88.942,1.858,106.13908,45.0\nCMR,AF,51.512,5.017,28.35272,4.3\nCHN,AS,49.226,1.65,53.90469,34.3\nCOL,SA,75.02,2.376,48.75452,36.5\nCRI,NA,64.186,1.847,71.42499,36.5\nCUB,NA,75.215,1.467,99.86296,15.9\nCPV,AF,61.833,2.427,69.68174,30.0\nCUW,NA,,2.2,,\nCYP,EU,70.311,1.478,79.09064,52.99\nCZE,EU,73.464,1.49,108.39144,68.82\nDEU,EU,73.815,1.39,113.53999,82.0\nDJI,AF,76.999,3.604,,6.5\nDNK,EU,86.795,1.87,99.84312,88.72\nDMA,NA,67.06,,112.42568,47.45\nDOM,NA,69.073,2.584,38.2921,31.4\nDZA,AF,72.024,2.817,77.3727,12.5\nECU,SA,66.863,2.655,140.01516,29.03\nEST,EU,69.461,1.63,87.68158,74.1\nEGY,AF,43.375,2.883,29.04993,31.42\nERI,AF,20.9,4.968,13.60618,\nESP,EU,77.284,1.38,126.40067,65.8\nETH,AF,16.757,4.902,4.82409,0.75\nFIN,EU,83.558,1.87,67.66847,86.89\nFJI,OC,51.837,2.67,,20.0\nFSM,OC,22.514,3.46,,20.0\nFRO,EU,40.926,,,75.2\nFRA,EU,85.229,2.03,108.71437,80.1\nGAB,AF,85.838,4.214,,7.23\nGBR,EU,79.508,1.98,83.39159,85.0\nGRD,NA,38.813,2.24,98.58843,33.46\nGEO,AS,52.742,1.82,,26.9\nGHA,AF,51.215,4.052,,7.8\nGIB,EU,,,,\nGRL,NA,84.383,2.2,,63.0\nGMB,AF,56.656,5.796,30.44526,9.2\nGIN,AF,34.968,5.174,13.66958,1.0\nGLP,NA,,,,\nGNQ,AF,39.337,5.14,,6.0\nGRC,EU,61.219,1.51,74.41279,44.4\nSGS,AN,,,,\nGTM,NA,49.328,3.974,66.6234,10.5\nGUM,OC,93.174,2.472,,54.04\nGNB,AF,43.22,5.115,6.9466,2.45\nGUY,SA,28.311,2.682,75.90297,29.9\nHKG,AS,100.0,1.127,,72.0\nHMD,AN,,,,\nHND,NA,51.577,3.154,43.82219,11.09\nHRV,EU,57.537,1.46,61.34352,56.55\nHTI,NA,51.99,3.35,,8.37\nHUN,EU,68.965,1.25,85.17133,65.0\nIDN,AS,49.924,2.434,43.43366,10.92\nIRL,EU,61.898,2.07,47.64842,69.85\nISR,AS,91.823,3.03,97.3572,67.5\nIMN,EU,50.592,,,\nIND,AS,30.93,2.563,54.83673,7.5\nIRQ,AS,66.536,4.211,,2.5\nIRN,AS,68.938,1.904,42.32655,14.7\nISL,EU,93.624,2.2,96.67277,93.39\nITA,EU,68.22,1.41,97.9848,53.68\nJAM,NA,51.992,2.334,112.97148,27.67\nJOR,AS,82.473,3.458,32.4053,27.2\nJPN,AS,90.541,1.39,87.72215,78.21\nKEN,AF,23.571,4.616,,14.0\nKGZ,AS,35.304,3.06,19.06075,18.4\nKHM,AS,19.814,2.966,13.20781,1.26\nKIR,OC,43.807,3.048,,9.07\nCOM,AF,27.97,4.919,,5.1\nKNA,NA,31.94,,89.81876,76.0\nPRK,AS,60.21,2.003,,\nKOR,AS,82.933,1.226,118.88248,83.7\nXKX,EU,,,,\nKWT,AS,98.242,2.673,,61.4\nCYM,NA,100.0,,,66.0\nKAZ,AS,53.732,2.59,,31.6\nLAO,AS,33.121,3.29,21.63763,7.0\nLBN,AS,87.136,1.513,81.48886,43.68\nLCA,NA,18.326,1.982,60.13359,43.3\nLIE,EU,14.448,1.4,103.7448,80.0\nLKA,AS,15.041,2.343,84.08892,12.0\nLBR,AF,47.801,5.024,,2.3\nLSO,AF,26.847,3.207,32.70182,3.86\nLTU,EU,67.001,1.55,73.87992,62.12\nLUX,EU,85.186,1.63,89.32044,90.62\nLVA,EU,67.716,1.17,83.8045,68.42\nLBY,AF,77.563,2.525,,14.0\nMAR,AF,56.676,2.583,57.68573,52.0\nMCO,EU,100.0,,,75.0\nMDA,EU,46.936,1.477,75.50635,32.3\nMNE,EU,63.096,1.698,30.9532,37.5\nMAF,NA,,1.8,,\nMDG,AF,31.93,4.654,8.82556,1.7\nMHL,OC,71.532,,,7.0\nMKD,EU,59.189,1.452,25.46899,51.9\nMLI,AF,34.277,6.841,3.16347,1.9\nMMR,AS,32.083,2.003,10.18729,0.25\nMNG,AS,67.567,2.437,77.3911,10.2\nMAC,AS,100.0,1.003,80.0852,55.198\nMNP,OC,91.347,,,\nMTQ,NA,,,,\nMRT,AF,41.23,4.837,,4.0\nMSR,NA,,,,\nMLT,EU,94.671,1.38,116.86797,63.0\nMUS,AF,41.779,1.47,96.38743,28.33\nMDV,AS,39.994,2.339,113.56313,26.53\nMWI,AF,15.543,5.636,,2.26\nMEX,NA,77.825,2.281,101.47991,31.05\nMYS,AS,72.006,2.002,68.62796,56.3\nMOZ,AF,30.958,5.409,,4.17\nNAM,AF,37.818,3.229,,11.6\nNCL,OC,61.899,2.193,,42.0\nNER,AF,17.616,7.584,4.33398,0.83\nNFK,OC,,,,\nNGA,AF,49.001,6.022,13.91442,24.0\nNIC,NA,57.252,2.631,55.35341,10.0\nNLD,EU,82.747,1.79,93.07955,90.72\nNOR,EU,79.102,1.95,99.19246,93.39\nNPL,AS,16.656,2.619,,7.93\nNRU,OC,,,,\nNIU,OC,,,,\nNZL,OC,86.194,2.16,93.08026,83.0\nOMN,AS,73.188,2.901,,35.8278\nPAN,NA,74.611,2.549,66.99949,40.1\nPER,SA,76.911,2.511,79.13209,34.77\nPYF,OC,51.42,2.11,,49.0\nPNG,OC,12.432,3.954,,1.28\nPHL,AS,48.648,3.151,,25.0\nPAK,AS,35.882,3.43,,8.0\nPOL,EU,60.945,1.38,71.06981,62.32\nSPM,NA,,,,\nPCN,OC,,,,\nPRI,NA,98.773,1.664,96.22601,45.3\nPSE,AS,74.133,4.216,39.46162,37.4\nPRT,EU,60.506,1.36,82.85457,53.3\nPLW,OC,83.368,,,\nPRY,SA,61.374,2.968,35.41621,19.8\nQAT,AS,98.655,2.085,,81.6\nREU,AF,,,,\nROU,EU,52.792,1.33,78.98901,39.93\nSRB,EU,56.033,1.4,52.70153,40.9\nRUS,EU,73.652,1.54,,43.0\nRWA,AF,18.81,4.841,10.29621,8.0\nSAU,AS,82.084,2.829,10.99211,41.0\nSLB,OC,20.005,4.236,49.38594,5.0\nSYC,AF,53.235,2.1,101.52196,41.0\nSDN,AF,33.084,4.637,,16.7\nSSD,AF,17.858,5.194,,\nSWE,EU,85.056,1.98,94.98664,90.0\nSGP,AS,100.0,1.15,,71.0\nSHN,AF,,,,\nSVN,EU,49.959,1.57,89.73008,70.0\nSJM,EU,,,,\nSVK,EU,54.834,1.4,91.04883,75.71\nSLE,AF,38.876,4.943,,0.58\nSMR,EU,94.089,,92.89568,\nSEN,AF,42.252,5.05,13.18101,16.0\nSOM,AF,37.289,6.869,,\nSUR,SA,69.326,2.345,,31.59\nSTP,AF,61.988,4.287,45.60503,18.75\nSLV,NA,64.28,2.263,64.01114,15.9\nSXM,NA,,,,\nSYR,AS,55.673,3.078,9.67397,20.7\nSWZ,AF,21.316,3.559,22.67761,11.04\nTCA,NA,93.258,,,\nTCD,AF,21.739,6.596,1.93102,1.7\nATF,AN,,,,\nTGO,AF,37.533,4.792,8.6128,3.0\nTHA,AS,33.73,1.443,99.17658,22.4\nTJK,AS,26.5,3.78,8.66398,11.55\nTKL,OC,,,,\nTLS,OC,27.96,5.578,,0.21\nTKM,AS,48.41,2.412,,3.0\nTUN,AF,66.098,2.13,,36.8\nTON,OC,23.368,3.914,,16.0\nTUR,AS,70.487,2.101,26.35232,39.82\nTTO,NA,13.444,1.802,,48.5\nTUV,OC,50.148,,,25.0\nTWN,AS,,,,\nTZA,AF,26.279,5.428,33.23627,11.0\nUKR,EU,68.685,1.445,97.36692,23.3\nUGA,AF,15.158,6.155,13.88397,12.5\nUMI,OC,,,,\nUSA,NA,82.143,1.931,68.9514,74.0\nURY,SA,92.453,2.08,88.73127,46.4\nUZB,AS,36.204,2.499,25.89003,20.0\nVAT,EU,,,,\nVCT,NA,48.918,2.07,,38.5\nVEN,SA,93.314,2.472,73.27579,37.37\nVGB,NA,,,,\nVIR,NA,95.281,1.8,,31.22\nVNM,AS,30.393,1.82,,30.65\nVUT,OC,24.589,3.499,58.68501,8.0\nWLF,OC,,,,\nWSM,OC,20.078,4.338,37.80934,7.0\nYEM,AS,31.742,4.498,1.16298,12.35\nMYT,AF,,,,\nZAF,AF,61.546,2.467,,24.0\nZMB,AF,38.725,5.813,,10.0\nZWE,AF,38.13,3.721,,11.5\nSCG,EU,,,,\nANT,NA,,,,"
        );
    }
}
