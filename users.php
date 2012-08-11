<?php

$users_filename = './users.txt';
$users_timeout = 30000;

$retry_timeout = 2000;

require_once('functions.php');

header('Content-Type: text/event-stream');
header('Cache-Control: no-cache');

header('Access-Control-Allow-Origin: *');

// prevent bufferring
if (function_exists('apache_setenv')) {
@apache_setenv('no-gzip', 1);
}
@ini_set('zlib.output_compression', 0);
@ini_set('implicit_flush', 1);
//for ($i = 0; $i < ob_get_level(); $i++) { ob_end_flush(); }
ob_implicit_flush(1);

// For Internet Explorer, send 2KB of padding to work around a bug
$browser = $_SERVER['HTTP_USER_AGENT'];
if (strpos($browser, 'MSIE') != false) {
// Internet Explorer
echo ':' . str_repeat(' ', 2048) . "\n";
}


// Refresh the current user in the list of online users
$users = load($users_filename);
$users = prune($users, $users_timeout);

// Remove the user's current entry in the list
for ($i=0; $i<count($users); $i++) {
    if ($users[$i]['name'] == $name) {
        array_splice($users, $i, 1);
        break;
    }
}

// Add the user to the list
$entry = array('time' => mtime(), 'name' => $name);
array_push($users, $entry);
write($users_filename, $users);

// Send the list of online users
$users_list = array();
foreach ($users as $user) {
    array_push($users_list, $user['name']);
}
$users_list = json_encode($users_list);
send_message(mtime(), $users_list, 'users');

send_retry_message($retry_timeout);

exit();