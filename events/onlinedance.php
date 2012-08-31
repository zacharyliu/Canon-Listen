<?php
header('Content-Type: text/json');
header('Cache-Control: no-cache');

date_default_timezone_set('America/New_York');

if (date('l') == 'Saturday') {
    $data['startTime'] = date('U', strtotime('this Saturday 9:00pm'));
} else {
    $data['startTime'] = date('U', strtotime('this Friday 9:00pm'));
}

$data['title'] = 'Online Dance';
$data['playlist'] = 'playlists/onlinedance.json';

echo json_encode($data);