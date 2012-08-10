<?php
header('Content-Type: text/json');
header('Cache-Control: no-cache');

$interval = 60*60; // number of seconds between new events

$data['title'] = 'Demo Mode';
$data['playlist'] = 'playlists/lancaster.json';
$data['startTime'] = floor(time()/$interval)*$interval;

echo json_encode($data);