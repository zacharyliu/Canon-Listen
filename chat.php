<?php

$cache_filename = './chat.txt';
$cache_timeout = 10000;
$server_timeout = 25000;

$retry_timeout = 1000;

$log_filename = './log.txt';

require_once('functions.php');

if (isset($_POST['message'])) {
    // Got a new message
    $message = $_POST['message'];
    
    // Add message to cache
    add_to_cache('message', $message);
    
    // Log the chat message
    $log_message = '(' . $_SERVER["REMOTE_ADDR"] . ') ' . $name . ': ' . urldecode($message) . PHP_EOL;
    file_put_contents($log_filename, $log_message, FILE_APPEND);
} else if (isset($_POST['event'])) {
    $event = $_POST['event'];
    
    if ($event == 'typing') {
        // Typing notification
        add_to_cache('typing');
    }
} else {
    // Not a new item, instead initalize Server-Sent Events service
    
    // Get inital time
    $load_time = mtime();
    
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
    
    
    
    // Begin checking for new messages and streaming them to the browser when appropriate
    if (isset($_SERVER['HTTP_LAST_EVENT_ID'])) {
        $last_event_id = intval($_SERVER['HTTP_LAST_EVENT_ID']);
    } else if (isset($_GET['Last-Event-ID'])) {
        $last_event_id = intval($_GET['Last-Event-ID']);
    } else {
        $last_event_id = $load_time - $cache_timeout;
    }
    
    send_retry_message($retry_timeout);
    
    $last_load_time = 0;
    
    while (mtime() - $load_time < $server_timeout) {
        $cache = load($cache_filename, false);
        
        foreach ($cache as $message) {
            if ($message['time'] > $last_event_id) {
                $last_event_id = $message['time'];
                if ($message['event'] != 'message') {
                    $event = $message['event'];
                } else {
                    $event = null;
                }
                send_message($message['time'], json_encode($message), $event);
            }
        }
        
        exit();
        
        usleep(200000);
    }
    
    exit();
}
