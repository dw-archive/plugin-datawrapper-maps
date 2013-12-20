
$(document).ready(function() {
    // Automatic selection
    dw.backend.on('sync-option:map-selector', function(args) {
        var chart = dw.backend.currentChart,
            rt = $('#vis-options-'+args.key),
            $select = $('select.map', rt),
            $options = $('option', $select);

        if (!chart.get('metadata.visualize.map')) {
            // There is no defined map, we use the first map
            chart.set('metadata.visualize.map', args.option.options[0].value );
            chart.set('metadata.visualize.map-path', args.option.options[0].path);

        } else {
            $('.map option[value='+chart.get('metadata.visualize.map')+']', rt).prop("selected", true);
        }
        // Bind events
        $select.off('change').change(function(e){
            $('.notification').remove();
            var map_id = $select.val(),
                map_path = $('option[value='+map_id+']', $select).data('path');
            chart.set('metadata.visualize.map', map_id);
            chart.set('metadata.visualize.map-path', map_path);
        });
    });
});