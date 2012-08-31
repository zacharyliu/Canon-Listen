<?php
header('Content-Type: text/json');
header('Cache-Control: no-cache');

$interval = 60*120; // number of seconds between new events

$data['title'] = 'Demo Mode';
$data['playlist'] = 'playlists/imported.json';
$data['startTime'] = floor(time()/$interval)*$interval;

echo json_encode($data);