<?php

if (isset($_GET['name'])) {
    $name = $_GET['name'];
} else {
    $name = 'anonymous';
}

function load($filename, $persistant = true) {
    if (filesize($filename) > 0) {
        $data = file_get_contents($filename);
        $data = unserialize($data);
    } else {
        $data = array();
    }
    
    return $data;
}

function write($filename, $data) {
    $data = serialize($data);
    file_put_contents($filename, $data);
}

function prune($data, $timeout) {
    $i = 0;
    while ($i < count($data)) {
        if (mtime() - $data[$i]['time'] > $timeout) {
            array_splice($data, $i, 1);
        } else {
            $i++;
        }
    }
    
    return $data;
}

function send_message($id, $msg, $event = null) {
    if ($event != null) {
        echo "event: $event" . PHP_EOL;
    }
    if ($id != null) {
        echo "id: $id" . PHP_EOL;
    }
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

function add_to_cache($event = 'message', $message = null) {
    global $cache_filename, $cache_timeout, $name;
    
    // Load chat cache
    $cache = load($cache_filename);
    
    // Prune old entries
    $cache = prune($cache, $cache_timeout);
    
    // Add new entry
    $entry = array('time' => mtime(), 'event' => $event, 'message' => $message, 'name' => $name);
    array_push($cache, $entry);
    
    // Write new cache file
    write($cache_filename, $cache);
}

function mtime() {
    return intval(microtime(true) * 1000);
}

function error_handler($errno, $errstr) {
    send_message(null, "Error: $errno - $errstr", 'debug');
}
set_error_handler('error_handler');