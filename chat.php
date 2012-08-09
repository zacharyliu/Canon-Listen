<?php

$cache_filename = './chat.txt';
$cache_timeout = 10000;
$users_filename = './users.txt';
$users_timeout = 60000;
$server_timeout = 25000;

if (isset($_GET['name'])) {
    $name = $_GET['name'];
} else {
    $name = 'anonymous';
}

function load($filename, $persistant = true) {
    if (filesize($filename) > 0) {
        $file = fopen($filename, 'r');
        $data = false;
//        if ($persistant) {
///            while ($data == false) {
//                $data = fread($file, filesize($filename));
//            }
//        } else {
            $data = fread($file, filesize($filename));
            if ($data == false) {
                $data = array();
            }
//        }
        fclose($file);
        
        //$data = preg_replace('!s:(\d+):"(.*?)";!se', "'s:'.strlen('$2').':\"$2\";'", $data); 
        $data = trim($data);
        $data = unserialize($data);
    } else {
        $data = array();
    }
    
    return $data;
}

function write($filename, $data) {
    $data = serialize($data);
    $file = fopen($filename, 'w');
    $status = false;
//    while ($status == false) {
        $status = fwrite($file, $data);
//    }
    fclose($file);
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

if (isset($_POST['message'])) {
    // Got a new message
    $message = $_POST['message'];
    
    // Add message to cache
    add_to_cache('message', $message);
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
    
    //send_message(null, 'Test', 'debug');
    
    // Refresh the current user in the list of online users
    $users = load($users_filename);
    $users = prune($users, $users_timeout);
    // Make sure the user isn't already in the list
    $user_already_present = false;
    foreach ($users as $user) {
        if ($user['name'] == $name) {
            $user_already_present = true;
            break;
        }
    }
    if (!$user_already_present) {
        $entry = array('time' => mtime(), 'name' => $name);
        array_push($users, $entry);
        write($users_filename, $users);
    }
    
    // Send the list of online users
    $users_list = array();
    foreach ($users as $user) {
        array_push($users_list, $user['name']);
    }
    $users_list = json_encode($users_list);
    send_message(null, $users_list, 'users');
    
    // Begin checking for new messages and streaming them to the browser when appropriate
    if (isset($_SERVER['HTTP_LAST_EVENT_ID'])) {
        $last_event_id = $_SERVER['HTTP_LAST_EVENT_ID'];
    } else {
        $last_event_id = 0;
    }
    
    send_retry_message(250);
    
    $last_load_time = 0;
    
    while (mtime() - $load_time < $server_timeout) {
        $mtime = filemtime($cache_filename);
        clearstatcache();
        if ($mtime != $last_load_time) {
            $cache = load($cache_filename, false);
            $last_load_time = $mtime;
            
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
        }
        
        usleep(100000);
    }
    
    exit();
}
