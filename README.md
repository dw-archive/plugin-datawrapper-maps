# Create a Map for Map-plugin

*Datawrapper, 2013*

#### Required

* [kartograph.py](http://kartograph.org/docs/kartograph.py/)

## 1. Create a SVG map file with Kartograph.py

1. find and download a shapfile. [Natural Earth](http://www.naturalearthdata.com/downloads/) is a good start.
2. Create a json configuration file. See the [Kartograph.py documentation](http://kartograph.org/docs/kartograph.py/) to do that.  
**Important:** For your main layout, set the `key` and `label` attributes.  
For instance, a world map:
```json
# config.json
{
    "layers": {
        "countries": {
            "src": "ne_50m_admin_0_countries.shp",
            "simplify": 1,
            "attributes": {
                "key": "iso_a3",
                "label": "name"
            }
        }
    },
    "bounds": {
        "mode": "bbox", 
        "data": [-140.8, -53.1, 180.8, 80.5]
    },
    "proj": {
        "id": "winkel3",
        "lon0": 0
    }
}

```
3. Then you can generate your svg file with the command:

```bash
$ kartograph config.json -o map.svg
```

## 2. Create a new plugin

A plugin can contains several maps.  
In `/plugins/`, create a new folder named `map-<region_name>[-<specificity>]/`.  
for instance:

* `map-de-elections`
* `map-fr-regions`
* `map-europe`

This is the architecture you have to make:
```html
map-<region_name>[-<specificity>]/
  + static/
  |  + <region_name>[-<specificity>]-map_id1
  |  |  + locale/
  |  |  |  - de.json
  |  |  |  - fr.json
  |  |  |  - en.json
  |  |  - map.json
  |  |  - map.svg
  |  + <region_name>[-<specificity>]-map_id2
  |  |  + locale/
  |  |  |  - de.json
  |  |  |  - fr.json
  |  |  |  - en.json
  |  |  - map.json
  |  |  - map.svg
  - package.json
  - plugin.php
```

## 3. Configuration

### static/&lt;map_id&gt;/locale/

A json locale file contains all the labels related to the keys.

```json
{
	"CYP":"Cyprus",
	"CZE":"Czech Republic",
	"DEU":"Germany",
	...
}
```

### static/&lt;map_id&gt;/map.json

```json
{
    "title" : {
        "en" : "World Map 2013",
        "fr" : "World Map 2013",
        "es" : "World Map 2013",
        "de" : "World Map 2013"
    },
    "keys" : ["CYP", "CZE", "DEU", etc...],
    "layers" : {
        "bg": {
            "src":"countries",
            "styles": {
                "stroke-width" : 6,
                "fill" : "none",
                "stroke": "#ddd",
                "stroke-linejoin": "round"
            }
        },
        "layer0": {
            "src": "countries",
            "styles": {
                "stroke-width" : "1",
                "fill" : "#F7F2F2"
            }
        }
    }
}
```

### package.json

```json 
{
    "name": "map-world",
    "version": "0.1",
    "author": "you",
    "dependencies": {
        "visualization-maps": "*"
    },
    "contributors": [{
    }],
    "repository": {
       "type": "git",
       "url": "git@git:git"
   }
}
```

### plugin.php

```php
<?php
class DatawrapperPlugin_MapWorld extends DatawrapperPlugin {
    public function init() {
        DatawrapperHooks::execute(
            DatawrapperPlugin_VisualizationMaps::HOOK_REGISTER_MAP,
            'world',
            'plugins/' . $this->getName() . '/world'
        );
    }
}

```
