<?php

class DatawrapperPlugin_VisualizationMaps extends DatawrapperPlugin_Visualization {

    public function getMeta() {
        return array(
            "id" => "maps",
            "libraries" => array(
                "vendor/raphael.min.js",
                "vendor/kartograph.min.js",
                "vendor/chroma.min.js"
            )
        );
    }
}
