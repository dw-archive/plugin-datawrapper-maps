<?php

class DatawrapperPlugin_VisualizationMaps extends DatawrapperPlugin_Visualization {

    private function getMaps() {
        $maps = scandir(dirname(__FILE__).'/static/maps');
        $maps = array_filter($maps, function($var){return strncmp($var, ".", 1);});
        return $maps;
    }

    private function getMapsAsOption() {
        $res = array();
        foreach ($this->getMaps() as $map) {
            $res[] = array(
                'value' => $map,
                'label' => $map
            );
        }
        return $res;
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
                "default" => $this->getMapsAsOption()[0]['value']
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
