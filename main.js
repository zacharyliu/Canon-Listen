var ui = {
    playlist: {
        importData: function(data) {
            for (var i=0; i<data.sections.length; i++) {
                var section = data.sections[i];
                var html = '<div class="playlist_header">' + section.title + '</div><ul class="playlist_items"></ul>';
                $("#playlist").append(html);
                var html = '';
                for (var a=0; a<section.songs.length; a++) {
                    var song = section.songs[a];
                    var html = '<li>' + song.title + '</li>';
                    $("#playlist ul:last-child").append(html);
                }
            }
        },
        setCurrent: function(title) {
            $("#playlist li").each(function(){
                if ($(this).html() == title) {
                    $("#playlist li").removeClass('current_song');
                    $(this).addClass('current_song');
                    return false;
                }
            })
        }
    },
    users: {
        refresh: function(newArray) {
            var results = this.__search(this.__getOldArray(), newArray);
            console.log(results);
            for (var i=0; i<results.remove.length; i++) {
                this.__remove(results.remove[i].index);
            }
            for (var i=0; i<results.add.length; i++) {
                this.__add(results.add[i].index, results.add[i].name);
            }
        },
        __getOldArray: function() {
            var oldArray = [];
            $("#users_list li").each(function() {
                oldArray.push($(this).html());
            });
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
            var html = '<li>' + name + '</li>'; 
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
        name: 'anonymous',
        __getURL: function() {
            return 'chat.php?name=' + encodeURIComponent(this.name)
        },
        init: function() {
            // Initialize Server-Sent Events service
            if (!!window.EventSource) {
                var source = new EventSource(this.__getURL());
                
                // Add event handlers
                source.addEventListener('users', function(e) {
                    var data = JSON.parse(e.data);
                    ui.users.refresh(data);
                }, false);
                source.addEventListener('message', function(e) {
                    var data = JSON.parse(e.data);
                    ui.chat.message.display(data.name, data.message);
                }, false);
                
                // Bind event handler to the input field to send a message
                $("#chat_input_content").keypress(function(e) {
                    // Send a typing notification, at most once a second
                    
                    // If the enter key is pressed
                    if (e.which == 13) {
                        // Get the current message
                        var message = $("#chat_input_content").val();
                        
                        // Send the message
                        ui.chat.message.send(message);
                        
                        // Clear the message from the input field
                        $("#chat_input_content").val("");
                    }
                });
            } else {
                alert("Sorry, your browser does not support real-time chat. Enjoy the music!");
            }
        },
        message: {
            display: function(name, message) {
                var html = '<div class="chat_history_item"><span class="chat_history_item_name">' + name + '</span><span class="chat_history_item_message">' + message + '</span></div>';
                $("#chat_history_typing").before(html);
            },
            send: function(message) {
                $.post(ui.chat.__getURL(), {'message': message});
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
                delete this.__current[name];
                this.__update();
            },
            __hidden: true,
            __update: function() {
                var count = utils.objCount(this.__current);
                if (count == 0) {
                    if (!this.__hidden) {
                        $("#chat_history_typing").html("").stop(true).animate({'height': '0'}, 100);
                        this.__hidden = true;
                    }
                } else {
                    var names = [];
                    for (item in this.__current) {
                        names.push(item);
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
                        $("#chat_history_typing").stop(true).animate({'height': '20px'}, 100);
                        this.__hidden = false;
                    }
                }
            }
        }
    },
    controls: {
        
    }
}

var utils = {
    objCount: function(obj) {
        var size = 0, key;
        for (key in obj) {
            if (obj.hasOwnProperty(key)) size++;
        }
        return size;
    }
}
