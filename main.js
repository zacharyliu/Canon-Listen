var ui = {
    __eventUrl: 'events/',
    socket: null,
    init: function() {
        // Connect to socket.io server
        this.socket = io.connect('//'+ location.hostname + ':8080');
        
        // Login to chat server
        ui.login(function() {
            ui.chat.init();
            ui.controls.init();
            ui.player.init();
        })
    },
    login: function(callback) {
        var this_class = this;
        // Get a chat username from the user
        ui.getName(function(name) {
            // Attempt to login using name
            this_class.socket.emit('login', {'name': name}, function(status) {
                switch (status) {
                    case 'success':
                        callback();
                        break;
                    case 'taken':
                        // Username is taken
                        var info = new ui.prompt('Sorry, that name is already in use. Please try again with a new name.', null, 'info');
                        info.onSubmit(function() {
                            // Try again
                            ui.login(callback);
                        });
                        info.show();
                        break;
                    case 'banned':
                        var info = new ui.prompt('Sorry, you have been banned from the chatroom, but you may enjoy the music.', null, 'info');
                        info.onSubmit(callback);
                        info.show();
                        break;
                    case 'password':
                        // Prompt for a password
                        var info = new ui.prompt('Please enter your password:', null, 'password');
                        info.onSubmit(function(password) {
                            this_class.socket.emit('login', {'name': name, 'password': password}, function(status) {
                                switch (status) {
                                    case 'success':
                                        callback();
                                        break;
                                    case 'incorrect':
                                        var info = new ui.prompt('Sorry, you entered the wrong password. Please try again.', null, 'info');
                                        info.onSubmit(function() {
                                            // Try again
                                            ui.login(callback);
                                        });
                                        info.show();
                                        break;
                                }
                            });
                        });
                        info.show();
                }
            });
        });
    },
    getName: function(callback) {
        var prompt = new ui.prompt('Enter your name:', $.cookie('chat_name'));
        prompt.onSubmit(function(name) {
            ui.chat.name = name;
            $.cookie('chat_name', name, {expires: 365});
            
            if (typeof(callback) === 'function') {
                callback(name);
            }
        });
        prompt.show();
    },
    playlist: {
        __playlist: {},
        __url: '',
        __totalPlaylistDuration: 0,
        init: function(callback) {
            var this_class = this;
            $.getJSON(this.__url + '?' + Date.now(), function(data) {
                this_class.__playlist = data;
                ui.playlist.importData(data);
                if (typeof(callback) == 'function') {
                    callback();
                }
            });
        },
        importData: function(data) {
            var itemIndex = 0;
            var delayFactor = 50;
            var fadeSpeed = 300;
            for (var i=0; i<data.sections.length; i++) {
                var section = data.sections[i];
                var html = '<div class="playlist_header">' + section.title + '</div><ul class="playlist_items"></ul>';
                $(html).css({'opacity': '0'}).appendTo("#playlist").delay(delayFactor * itemIndex).fadeTo(fadeSpeed, 1);
                itemIndex++;
                var html = '';
                for (var a=0; a<section.songs.length; a++) {
                    var song = section.songs[a];
                    ui.playlist.__totalPlaylistDuration = ui.playlist.__totalPlaylistDuration + song.duration;
                    var html = '<li>' + song.title + '</li>';
                    $(html).css({'opacity': '0'}).appendTo("#playlist ul:last-child").delay(delayFactor * itemIndex).fadeTo(fadeSpeed, 1);
                    itemIndex++;
                }
            }
            console.log("Total playlist duration: " + ui.playlist.__totalPlaylistDuration);
        },
        setCurrent: function(title) {
            $("#playlist li").each(function(){
                if ($(this).html() == title) {
                    $("#playlist li").removeClass('current_song');
                    $(this).addClass('current_song');
                    $("#playlist").scrollTo($(this), 300);
                    return false;
                }
            });
        },
        getSongs: function() {
            var data = ui.playlist.__playlist;
            var songs = [];
            for (var i=0; i<data.sections.length; i++) {
                for (var a=0; a<data.sections[i].songs.length; a++) {
                    songs.push(data.sections[i].songs[a]);
                }
            }
            
            //songs = songs.reverse();
            
            return songs;
        }
    },
    users: {
        refresh: function(newArray) {
            newArray = newArray.sort();
            var results = this.__search(this.__getOldArray(), newArray);
            for (var i=0; i<results.remove.length; i++) {
                this.__remove(results.remove[i].index);
            }
            for (var i=0; i<results.add.length; i++) {
                this.__add(results.add[i].index, results.add[i].name);
            }
            
            $("#indicator").html(newArray.length + ' online');
        },
        __getOldArray: function() {
            var oldArray = [];
            $("#users_list li").each(function() {
                oldArray.push($(this).html());
            });
            oldArray = oldArray.sort();
            return oldArray;
        },
        __search: function(oldArray, newArray) {
            var results = {
                remove: [],
                add: [],
            };
            // Iterate through old users and find users to remove
            var i = 0;
            while (i<oldArray.length) {
                var item = oldArray[i];
                var index = $.inArray(item, newArray);
                if (index == -1) {
                    // User should be removed, is no longer in new list 
                    // Get old index, then remove from old array to recalculate index for next item
                    var index = $.inArray(item, oldArray);
                    results.remove.push({index: index});
                    oldArray.pop(index);
                } else {
                    i++;
                }
            }
            
            // Iterate through new users and find users to add
            var i = 0;
            while (i<newArray.length) {
                var item = newArray[i];
                var index = $.inArray(item, oldArray);
                if (index == -1) {
                    // Found a new user to add, figure out the new index
                    // Add to array and then resort to calculate where it should go
                    oldArray.push(item);
                    oldArray.sort();
                    var index = $.inArray(item, oldArray);
                    results.add.push({index: index, name: item});
                }
                i++;
            }
            
            return results;
        },
        __add: function(index, name) {
            // index is the new index of the item after insertion
            var html = '<li>' + utils.htmlEncode(name) + '</li>';
            var $object = $(html);
            $object.css({height: 0, opacity: 1}).addClass('animating');
            if (index < $("#users_list li:not(.animating)").length) {
                $("#users_list li:not(.animating)").eq(index).before($object);
            } else {
                $("#users_list").append($object);
            }
            $object.animate({height: '1.3em', opacity: 1}, 500, function(){
                $(this).removeClass('animating');
            });
        },
        __remove: function(index) {
            $("#users_list li:not(.animating)").eq(index).addClass('animating').animate({height: '0em', opacity: 0}, 500, function() {
                $(this).remove();
            });
        }
        
    },
    chat: {
        init: function() {                
            // Add event handlers
            ui.socket.on('userlist', function(data) {
                ui.users.refresh(data);
            });
            ui.socket.on('chat', function(data) {
                ui.chat.message.display(data.name, data.message);
            });
            ui.socket.on('typing', function(data) {
                ui.chat.typingNotification.display(data.name);
            });
            ui.socket.on('debug', function(data) {
                console.log(data);
            });
            ui.socket.on('server', function(data) {
                ui.chat.message.displayServer(data);
            });
            ui.socket.on('disconnect', function() {
                var info = new ui.prompt('You have been disconnected.', null, 'info');
                info.show();
            });
            ui.socket.on('ban_list', function(data) {
                console.log(data);
            });
            
            // Bind event handler to the input field to send a message
            $("#chat_input_content").keypress(function(e) {// If the enter key is pressed
                if (e.which == 13) {
                    // Get the current message
                    var message = $("#chat_input_content").val();
                    
                    // Send the message
                    ui.chat.message.send(message);
                    
                    // Clear the message from the input field
                    $("#chat_input_content").val("");
                } else {
                    // Send a typing notification, at most once a second
                    ui.chat.typingNotification.send();
                }
            });
            
            // Update the typing notifications once
            ui.chat.typingNotification.__update();
            
            // Set focus to the chat box
            $("#chat_input_content").focus();
            
            // Send ready message
            ui.socket.emit('ready');
        },
        message: {
            display: function(name, message) {
                var html = '<div class="chat_history_item"><span class="chat_history_item_name"></span><span class="chat_history_item_message"></span></div>';
                $(html).insertBefore("#chat_history_typing").css({'opacity': 0}).animate({'opacity': 1}, 50);
                $('.chat_history_item:last .chat_history_item_name').text(name);
                $('.chat_history_item:last .chat_history_item_message').text(message);
                
                // Remove any typing notification from this user
                ui.chat.typingNotification.remove(name);
                
                // Scroll the chat history
                $("#chat_history").scrollTo('max');
            },
            displayServer: function(message) {
                var html = '<div class="chat_history_item"><span class="chat_history_item_message chat_history_item_server"></span></div>';
                $(html).insertBefore("#chat_history_typing").css({'opacity': 0}).animate({'opacity': 1}, 50);
                $('.chat_history_item:last .chat_history_item_message').text(message);
                
                // Scroll the chat history
                $("#chat_history").scrollTo('max');
            },
            send: function(message) {
                if (message != '') {
                    ui.socket.emit('chat', {'message': message});
                }
            }
        },
        typingNotification: {
            __timeout: 3000,
            display: function(name) {
                this_class = this;
                
                // Clear the typing notification automatically after 3 seconds without an update
                // Reset the typing notification timer
                if (typeof(this.__current[name]) != 'undefined') {
                    window.clearTimeout(this.__current[name].timeoutID);
                }
                this.__current[name] = {};
                // Set a new timer
                this.__current[name].timeoutID = window.setTimeout(function() {
                    this_class.remove(name);
                }, this.__timeout);
                this.__current[name].name = name;
                
                this.__update();
            },
            __current: {},
            remove: function(name) {
                if (typeof(this.__current[name]) != 'undefined') {
                    window.clearTimeout(this.__current[name].timeoutID);
                    delete this.__current[name];
                    this.__update();
                }
            },
            __hidden: false,
            __update: function() {
                var count = utils.objCount(this.__current);
                if (count == 0) {
                    if (!this.__hidden) {
                        $("#chat_history_typing").html("").stop(true).animate({'opacity': '0', 'height': '0'}, 50);
                        this.__hidden = true;
                    }
                } else {
                    var names = [];
                    for (var item in this.__current) {
                        if (this.__current.hasOwnProperty(item)) {
                            names.push(utils.htmlEncode(item));
                        }
                    }
                    var phrase = "";
                    if (count == 1) {
                        phrase = names[0] + " is typing";
                    } else if (count == 2) {
                        phrase = names[0] + " and " + names[1] + " are typing";
                    } else {
                        for (var i=0; i<(names.length-1); i++) {
                            phrase = phrase + names[i] + ", ";
                        }
                        phrase = phrase + "and " + names[names.length-1] + " are typing"; 
                    }
                    $("#chat_history_typing").html(phrase);
                    if (this.__hidden) {
                        $("#chat_history_typing").stop(true).css({'height': '20px'}).animate({'opacity': '1'}, 50);
                        this.__hidden = false;
                    }
                }
                
                // Scroll the chat history
                $("#chat_history").scrollTo('max');
            },
            lastSent: 0,
            __floodRate: 1000,
            send: function() {
                if (Date.now() - this.lastSent > this.__floodRate) {
                    ui.socket.emit('typing');
                    this.lastSent = Date.now();
                }
            }
        }
    },
    controls: {
        init: function() {
            this.volume.init();
        },
        nowplaying: {
            update: function(title) {
                $("#nowplaying_song").animate({opacity: 0}, 200, function() {
                    $(this).html(title).animate({opacity: 1}, 200);
                });
            },
        },
        progress: {
            update: function(progress) {
                // progress is a float between 0 and 1 indicating the percentage of the video which has elapsed
                progress = (progress * 100) + "%";
                $("#progressbar_inner").css({width: progress});
            }
        },
        volume: {
            init: function() {
                $("#volumebar_handle").draggable({'axis': 'x', 'containment': 'parent', 'drag': function(e, ui) {
                    var left = $(this).css('left');
                    left = left.substr(0, left.length-2);
                    drivers.music.setVolume(left / 100);
                }});
            }
        }
    },
    player: {
        __eventData: {},
        init: function() {
            // Get event information
            $.getJSON(ui.__eventUrl + '?' + Date.now(), function(eventData) {
                console.log("Got event information");
                ui.player.__eventData = eventData;
                
                // Display event title
                $("#event_title").html(' - ' + eventData.title);
                
                // Load current event playlist
                ui.playlist.__url = eventData.playlist;
                ui.playlist.init(function() {
                    console.log("Loaded playlist");
                    // Sync time with server
                    $.get("time.txt?" + Date.now(), function(data, text, xhr) {
                        var dateStr = xhr.getResponseHeader('Date');
                        var serverTime = Date.parse(new Date(Date.parse(dateStr)).toUTCString()) / 1000;
                        
                        // Use event start time to calculate current position in playlist
                        var startTime = ui.player.__eventData.startTime;
                        var timelinePosition = serverTime - startTime;
                        
                        console.log(timelinePosition);
                        
                        // Make sure that the event has started, else don't play
                        if (timelinePosition < 0) {
                            //alert("The event hasn't started yet!");
                            // Queue up the timeline to play, and display a countdown
                            ui.player.timelineSetup(-1, (-1) * timelinePosition);
                        } else {
                            // Now figure out what song should be playing now
                            var songs = ui.playlist.getSongs();
                            console.log(songs);
                            var totalDuration = 0;
                            var currentIndex = null;
                            for (var i=0; i<songs.length; i++) {
                                totalDuration = totalDuration + songs[i].duration;
                                if (totalDuration > timelinePosition) {
                                    console.log("Found song at duration " + totalDuration);
                                    currentIndex = i;
                                    var time = timelinePosition - (totalDuration - songs[i].duration);
                                    break;
                                }
                            }
                            
                            console.log(currentIndex);
                            
                            // If we ran out of songs, then the event is over
                            if (currentIndex == null) {
                                alert("Oops, the event is over already!");
                            } else {
                                // Setup the timeline and start playback
                                ui.player.timelineSetup(currentIndex, time);
                            }
                        }
                            
                    });
                });
            });
        },
        timelineSetup: function(index, time) {
            var songs = ui.playlist.getSongs();
            
            // Insert timeouts for playing the next songs to create the timeline
            if (index != -1) {
                var totalTimeRemaining = songs[index].duration - time;
            } else {
                var totalTimeRemaining = time;
            }
            for (var i=index+1; i<songs.length; i++) {
                console.log("Adding timeout at: " + totalTimeRemaining + " for song " + i);
                this.__timelineAdd(i, totalTimeRemaining);
                totalTimeRemaining = totalTimeRemaining + songs[i].duration;
            }
            
            // Insert timeout for ending playback
            console.log("Adding final timeout at: " + totalTimeRemaining);
            window.setTimeout(function() {
                ui.player.stop();
            }, totalTimeRemaining * 1000);
            
            // Play current song now
            if (index != -1) {
                ui.player.play(index, time);
            }
        },
        __timelineAdd: function(index, delay) {
            window.setTimeout(function() {
                ui.player.play(index, 0);
            }, delay * 1000);
        },
        play: function(index, time) {
            console.log("Playing song " + index + " at time " + time);
            var songs = ui.playlist.getSongs();
            var song = songs[index];
            drivers.music.play(song, time);
            
            // Update the now playing indicator
            ui.controls.nowplaying.update(songs[index].title);
            
            // Update the currently playing song in the playlist display
            ui.playlist.setCurrent(songs[index].title);
        },
        end: function() {
            return;
        }
    },
    prompt: function(title, inital_value, type) {
        var this_class = this;
        var callback = function() {}
        
        // Setup prompt modal
        if (type == 'info') {
            var html = '<div class="prompt_modal"><div class="prompt"><div class="prompt_title"></div><input class="prompt_button" type="button" value="OK"></input></div></div>';
        } else if (type == 'password') {
            var html = '<div class="prompt_modal"><div class="prompt"><div class="prompt_title"></div><input class="prompt_input" type="password"></input></div></div>';
        } else {
            var html = '<div class="prompt_modal"><div class="prompt"><div class="prompt_title"></div><input class="prompt_input" type="text"></input></div></div>';
        }
        
        this.$ = $(html);
        this.$.find('.prompt_title').html(title);
        if (type != 'info') {this.$.find('.prompt_input').attr('value', inital_value)};
        this.$.css({'display': 'none'}).appendTo('body');
        
        if (type == 'info') {
            this.$.find('.prompt_button').click(function(e) {
                this_class.hide();
                callback();
            });
        } else {
            // Attach event handler to input box
            this.$.find('.prompt_input').keypress(function(e) {
                // If the enter key was pressed:
                if (e.which == 13) {
                    var data = $(this).attr('value');
                    this_class.hide();
                    callback(data);
                }
            });
        }
        
        this.onSubmit = function(newCallback) {
            callback = newCallback;
        }
        
        this.show = function() {
            // Show prompt modal
            this.$.css({'display': 'block'});
            this.$.find('.prompt').css({'margin-top': '-150px'}).animate({'margin-top': '-100px'}, 200);
            this.$.find('.prompt_modal').css({'opacity': 0}).animate({'opacity': 1}, 200);
            if (type == 'info') {
                this.$.find('.prompt_button').focus();
            } else {
                this.$.find('.prompt_input').focus();
            }
        }
        
        this.hide = function() {
            // Hide prompt modal
            this.$.find('.prompt').animate({'margin-top': '-50px'}, 200);
            this.$.animate({'opacity': 0}, 200, function() {
                $(this).css({'display': 'none'});
                $(this).remove();
            });
        }
    }
}

var drivers = {
    music: {
        __player: null,
        __firstPlay: true,
        __progressUpdater: null,
        __currentSong: null,
        play: function(song, time) {
            this.__currentSong = song;
            if (this.__player == null) {
                this.__player = new YT.Player('player', {
                    height: '200',
                    width: '280',
                    videoId: song.id,
                    playerVars: {
                        controls: 0,
                        disablekb: 1,
                        showsearch: 0,
                        modestbranding: 1,
                        enablejsapi: 1
                    },
                    events: {
                        'onReady': function(e) {
                            e.target.seekTo(time, true);
                            drivers.music.__progressUpdater = window.setInterval(function() {
                                drivers.music.updateProgress();
                            }, 200);
                        },
                        'onStateChange': function(e) {
                            if (drivers.music.__firstPlay && e.data == 1) {
                                e.target.seekTo(time, true);
                                drivers.music.__firstPlay = false;
                            }
                            if (e.data == YT.PlayerState.PAUSED) {
                                e.target.playVideo();
                            }
                        }
                    }
                });
            } else {
                this.__player.loadVideoById(song.id);
            }
        },
        updateProgress: function() {
            var currentTime = drivers.music.__player.getCurrentTime();
            var progress = currentTime / drivers.music.__currentSong.duration;
            if (progress > 1) {
                progress = 1;
            }
            
            ui.controls.progress.update(progress);
        },
        setVolume: function(volume) {
            // volume is a float between 0 and 1 specifying the desired volume percentage
            
            volume = Math.floor(volume * 100);
            drivers.music.__player.setVolume(volume);
        },
        stop: function() {
            drivers.music.__player.destroy();
        }
    }
}

var utils = {
    objCount: function(obj) {
        var size = 0, key;
        for (key in obj) {
            if (obj.hasOwnProperty(key)) size++;
        }
        return size;
    },
    htmlEncode: function(text) {
        return $('<div />').text(text).html();
    },
    htmlDecode: function(html) {
        return $('<div />').html(html).text();
    }
}

var includes = {
    __scripts: ['//www.youtube.com/iframe_api'],
    __numLoaded: 0,
    init: function() {
        for (var i=0; i<this.__scripts.length; i++) {
            $.getScript(this.__scripts[i], function() {
                includes.loaded();
            })
        }
    },
    loaded: function() {
        this.__numLoaded++;
        if (this.__numLoaded == this.__scripts.length) {
            ui.init();
        }
    }
}

$(function() {
    includes.init();
});
