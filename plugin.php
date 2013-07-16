<?php

class DatawrapperPlugin_VisualizationMaps extends DatawrapperPlugin_Visualization {

    function __construct() {
        $this->maps           = null;
        $this->maps_as_option = null;
    }

    private function getMaps() {
        if (!empty($this->maps)) return $this->maps;
        $maps = scandir(dirname(__FILE__).'/static/maps');
        $maps = array_filter($maps, function($var){return strncmp($var, ".", 1);});
        $this->maps = $maps;
        return $maps;
    }

    private function getMapsAsOption() {
        if (!empty($this->maps_as_option)) return $this->maps_as_option;
        $res = array();
        $locale = substr(DatawrapperSession::getLanguage(), 0, 2);
        foreach ($this->getMaps() as $map) {
            $json = json_decode(file_get_contents(dirname(__FILE__).'/static/maps/'.$map.'/map.json'), true);
            $label = $map;
            if (!empty($json['title'])) {
                if (!empty($json['title'][$locale])) {
                    $label = $json['title'][$locale];
                } elseif (!empty($json['title']['en'])) {
                    $label = $json['title']['en'];
                }
            }
            $res[] = array(
                'value' => $map,
                'label' => $label
            );
        }
        $this->maps_as_option = $res;
        return $res;
    }

    private function getDefaultMap() {
        $maps = $this->getMapsAsOption();
        $map = reset($maps);
        return $map['value'];
    }

    private function getAssets() {
        $assets = array();
        foreach ($this->getMaps() as $map) {
            $assets[] = "maps/".$map."/map.json";
            $assets[] = "maps/".$map."/map.svg";
        }
        return $assets;
    }

    private function getOptions() {
        $id = $this->getName();
        return array(
            "map" => array(
                "type" => "select",
                "label" => __("maps", $id),
                "options" => $this->getMapsAsOption(),
                "default" => $this->getDefaultMap()
            ),
            "legend-position" => array(
                "type"    => "radio",
                "label"   => __("Legend position", $id),
                "options" => array(
                    array(
                        "value" => "vertical",
                        "label" => __("vertical", $id)
                    ),
                    array(
                        "value" => "horizontal",
                        "label" => __("horizontal", $id)
                    )
                ),
                "default"    => "vertical",
            )
        );
    }
    public function getMeta() {
        $id = $this->getName();
        return array(
            "id" => "maps",
            "libraries" => array(
                "vendor/raphael.min.js",
                "vendor/kartograph.min.js",
                "vendor/chroma.min.js"
            ),
            "title"   => __("Maps", $id),
            "version" => "2.0",
            "order"   => 62,
            "assets"  => $this->getAssets(),
            "options" => $this->getOptions()
        );
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
