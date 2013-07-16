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
}
