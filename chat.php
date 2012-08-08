<?php

$cache_filename = 'chat.txt';
$cache_timeout = 10;
$users_filename = 'users.txt';
$users_timeout = 60;
$server_timeout = 25;

if (isset($_GET['name'])) {
    $name = $_GET['name'];
} else {
    $name = 'anonymous';
}

function load($filename) {
    $file = fopen($filename, 'r');
    while ($data == false) {
        $data = fread($file, filesize($filename));
    }
    fclose($file);
    
    $data = unserialize($data);
    
    return $data;
}

function write($filename, $data) {
    $data = serialize($data);
    $file = fopen($filename, 'w');
    $status = false;
    while ($status == false) {
        $status = fwrite($file, $data);
    }
    fclose($file);
}

function prune($data, $timeout) {
    $i = 0;
    while ($i < count($data)) {
        if (microtime(true) - $data[$i]['time'] > $timeout) {
            unset($data[$i]);
        }
        $i++;
    }
    
    return $data;
}

function send_message($id, $msg, $event = null) {
    if ($event != null) {
        echo "event: $event" . PHP_EOL;
    }
    echo "id: $id" . PHP_EOL;
    echo "data: $msg" . PHP_EOL;
    echo PHP_EOL;
    ob_flush();
    flush();
}

function send_retry_message($retry_time) {
    echo "retry: $retry_time" . PHP_EOL;
    echo PHP_EOL;
    ob_flush();
    flush();
}

if (isset($_GET['message'])) {
    // Got a new message
    $message = $_GET['message'];
    
    // Load chat cache
    $cache = load($cache_filename);
    
    // Prune old entries
    $cache = prune($cache, $cache_timeout);
    
    // Add new entry
    $entry = array('time' => microtime(true), 'message' => $message, 'name' => $name);
    array_push($cache, $entry);
    
    // Write new cache file
    write($cache_filename, $cache);
} else {
    // Not a new message, instead initalize Server-Sent Events service
    
    // Get inital time
    $load_time = microtime(true);
    
    $cache = load_cache();
    
    header('Content-Type: text/event-stream');
    header('Cache-Control: no-cache'); // recommended to prevent caching of event data.
    
    // Refresh the current user in the list of online users
    $users = load($users_filename);
    $users = prune($users, $users_timeout);
    $entry = array('time' => microtime(true), 'name' => $name);
    array_push($users, $entry);
    write($users_filename, $users);
    
    // Send the list of online users
    $users_list = array();
    foreach ($users as $user) {
        array_push($users_list, $user['name']);
    }
    $users_list = json_encode($users_list);
    send_message(microtime(true), $users_list, 'users');
    
    // Begin checking for new messages and streaming them to the browser when appropriate
    if (isset($_SERVER['Last-Event-ID'])) {
        $last_event_id = $_SERVER['Last-Event-ID'];
    } else {
        $last_event_id = 0;
    }
    
    send_retry_message(250);
    
    while (microtime(true) - $load_time < $server_timeout) {
        $cache = load($cache_filename);
        foreach ($cache as $message) {
            if ($message['time'] > $last_event_id) {
                send_message($message['time'], $message['message']);
            }
        }
        usleep(250000);
    }
    
    exit();
}
