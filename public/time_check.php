<?php
date_default_timezone_set('America/Caracas'); // Simulate config
echo "Timezone: " . date_default_timezone_get() . "\n";
echo "Timestamp (time()): " . time() . "\n";
echo "Formatted (date('r')): " . date('r') . "\n";
echo "GMDates (gmdate('r')): " . gmdate('r') . "\n";
