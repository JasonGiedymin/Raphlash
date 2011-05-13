(function() {
  /*
  Name: Raphlash.js
  Author: Jason Giedymin <jasong at apache dot org>, http://jasongiedymin.com
  Dependencies: jquery, raphaeljs
  Notes:
  The project started out just making cubes and having them flash with Raphael.
  Then it turned in to this huge... well just take a look...
  You can make cubes, create shapes, and even create text with cubes.
  You can also supply animation functions.

  If you look at the code you'll see this was just a big experiment with
  async code and timeouts with Raphael and is about 800 lines too much.

  If you want real 'animation' mechanics and backend, use processing.js.

  Back Log:
      - Maybe... do away with some of the [].length entries all over the place.
        aaah... maybe...
      - Address a few TODOs here.
      - Classes for buffers and control
          - Play/Next/Stop/Reset code is kinda all over the place...
      - Bugs? Tons. :-D
      - Leaks? Maybe. But I think I took care of them all. :-P
      - Logic? Look, this thing is one big experiment of weirdness. :-8
  */  var AnimateEffect, BASE_ANIMATE_RATE, BUFFER_LIMIT, BounceFallAnimation, CUBE_TIMEOUT, CardsAnimation, Character2ShapeClip, Clip, CubeAnimation, DEFAULT_FPS, EventManager, GentleFallAnimation, JelloFallAnimation, LOGGING_ENABLED, LightRaindropAnimation, MAX_CUBE_INDEXES, MAX_CUBE_ROWS, MaterializeAnimation, Movie, SIZE_CUBE, SIZE_VIEWPORT_HEIGHT, SIZE_VIEWPORT_WIDTH, ShapeClip, ZoomInAnimation, ZoomOutAnimation, clearAllIntervals, clearAllTimeouts, global_intervals, global_timeout, global_timeouts, init, initLogger, initMovie, initRaphaelMods, oldSetInterval, oldSetTimeout, rendered_caption, rendered_shapes, rendered_shapes_buffer, stopCurrentInterval, stopCurrentTimeout, _resetAllIntervals, _resetAllTimeouts;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; }, __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) {
    for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; }
    function ctor() { this.constructor = child; }
    ctor.prototype = parent.prototype;
    child.prototype = new ctor;
    child.__super__ = parent.prototype;
    return child;
  };
  DEFAULT_FPS = 25;
  CUBE_TIMEOUT = 250;
  /*
  To save you from yourself, and not blame me...
  As long as you didn't screw anything up, it should safely render 500+.
  I'm just making sure there isn't a run away async rendering waterfall...
  */
  BUFFER_LIMIT = 500;
  BASE_ANIMATE_RATE = 250;
  SIZE_CUBE = 22.15;
  MAX_CUBE_ROWS = 9;
  MAX_CUBE_INDEXES = 2;
  SIZE_VIEWPORT_HEIGHT = 300;
  SIZE_VIEWPORT_WIDTH = 886;
  LOGGING_ENABLED = true;
  /*
  While I don't enjoy global vars much, these are very useful and get a lot
  of action. Probably deserving of their own classes.
  I use a buffer here because shapes removed immediately will not transition,
  they disappear immediately (doh!). They get removed in the next frame instead.
  This is much easier than doing viewport detection (z-buffers) but is slightly
  more memory intensive.
  */
  rendered_caption = null;
  rendered_shapes = [];
  rendered_shapes_buffer = [];
  EventManager = {
    subscribe: function(event, fn, stacking) {
      if (stacking == null) {
        stacking = false;
      }
      if (!stacking) {
        if (this.unsubscribe(event, fn)) {
          return $(this).bind(event, fn);
        }
      } else {
        return $(this).bind(event, fn);
      }
    },
    unsubscribe: function(event, fn) {
      if (fn == null) {
        fn = null;
      }
      if (fn) {
        $(this).unbind(event, fn);
      } else {
        $(this).unbind(event);
      }
      return true;
    },
    unsubscribeAll: function() {
      return $(this).unbind();
    },
    publish: function(event, fn) {
      /*console.log("Event fired:[" + event + "].")*/      return $(this).trigger(event);
    }
  };
  global_intervals = [];
  global_timeouts = [];
  oldSetInterval = window.setInterval;
  oldSetTimeout = window.setTimeout;
  global_timeout = 0;
  window.setInterval = function(code, interval) {
    return global_intervals.push(oldSetInterval(code, interval));
  };
  window.setTimeout = function(code, timeout) {
    return global_timeout = oldSetTimeout(code, timeout);
  };
  _resetAllIntervals = function() {
    global_intervals = null;
    return global_intervals = [];
  };
  _resetAllTimeouts = function() {
    return global_timeout = null;
  };
  clearAllIntervals = function() {
    var interval, old_length, _i, _len;
    old_length = global_intervals.length;
    for (_i = 0, _len = global_intervals.length; _i < _len; _i++) {
      interval = global_intervals[_i];
      clearInterval(interval);
    }
    _resetAllIntervals();
    return console.log("[" + old_length + "] Intervals cleared.");
  };
  clearAllTimeouts = function() {
    clearTimeout(global_timeout);
    return _resetAllTimeouts();
  };
  stopCurrentInterval = function(last) {
    if (last == null) {
      last = true;
    }
    if (last) {
      return clearInterval(global_intervals.pop());
    } else {
      return clearInterval(global_intervals.shift());
    }
  };
  stopCurrentTimeout = function() {
    return clearTimeout(global_timeout);
  };
  Movie = (function() {
    function Movie(name, viewport, anchor, speed) {
      this.name = name;
      this.viewport = viewport;
      this.anchor = anchor;
      this.speed = speed != null ? speed : CUBE_TIMEOUT;
      this.stop = __bind(this.stop, this);;
      this.pause = __bind(this.pause, this);;
      this.virgin_viewport = this.viewport;
      console.log("New movie created: " + this.name);
      this.clip_queue = [];
      this.clip_index = 0;
      this.createControls();
    }
    Movie.prototype.addClip = function(new_clip) {
      console.log("Added clip.");
      return this.clip_queue.push(new_clip);
    };
    Movie.prototype.play = function() {
      /*
      Introducing a slight delay seems to help Firefox and Opera out with
      animating transitions. Don't want to use events for this. Trying to
      avoid using too many events especially when they lag.
      */      console.log("Playing index: " + this.clip_index);
      if ($.browser.mozilla || $.browser.opera) {
        return setTimeout((__bind(function() {
          console.log("Playing index: " + this.clip_index);
          this.rewind();
          this.clip_queue[this.clip_index].reset();
          return this.clip_queue[this.clip_index].play();
        }, this)), 250);
      } else {
        this.rewind();
        this.clip_queue[this.clip_index].reset();
        return this.clip_queue[this.clip_index].play();
      }
    };
    Movie.prototype.replay = function() {
      this.pause();
      return this.play();
    };
    Movie.prototype.rewind = function() {
      return this.clip_queue[this.clip_index].rewind();
    };
    Movie.prototype.playNext = function() {
      if (this.clip_index < this.clip_queue.length - 1) {
        this.pause();
        this.clip_index++;
        return this.play();
      } else {
        return console.log("Whoa slow down, there is nothing left!");
      }
    };
    Movie.prototype.playPrevious = function() {
      if (this.clip_index > 0) {
        this.pause();
        this.clip_index--;
        this.rewind();
        return this.play();
      } else {
        return console.log("Whoa slow down, there is nothing left!");
      }
    };
    Movie.prototype.pause = function() {
      console.log("Stopping index: " + this.clip_index);
      this.clip_queue[this.clip_index].stop();
      this.clip_queue[this.clip_index].reset();
      this.clip_queue[this.clip_index].removeCurrentCaption();
      return EventManager.unsubscribeAll();
    };
    Movie.prototype.stop = function() {
      console.log("Stopping index: " + this.clip_index);
      this.clip_queue[this.clip_index].stop();
      return EventManager.unsubscribeAll();
    };
    Movie.prototype.createControls = function() {
      var Path, anchor_next, anchor_previous, anchor_replay, anchor_stop, fill, green, icon1, icon2, icon_next, icon_next_set, icon_previous, icon_previous_set, icon_replay_set, icon_stop_set, none, orange, rect1, rect2, rect_next, rect_previous, selected, stroke, x, y;
      x = y = 0;
      fill = {
        fill: "#000",
        stroke: "none",
        opacity: 0.20
      };
      orange = {
        fill: "orange",
        stroke: "none",
        opacity: 0.50
      };
      green = {
        fill: "lightgreen",
        stroke: "none",
        opacity: 0.35
      };
      stroke = {
        stroke: "#fff",
        "stroke-width": 3,
        "stroke-linejoin": "round",
        opacity: 0
      };
      selected = false;
      Path = document.getElementById("control-stop");
      none = {
        fill: "#000",
        opacity: 0
      };
      anchor_stop = Raphael("control-stop", 37, 37);
      icon_stop_set = anchor_stop.set();
      anchor_replay = Raphael("control-replay", 37, 37);
      icon_replay_set = anchor_replay.set();
      anchor_previous = Raphael("control-previous", 37, 37);
      icon_previous_set = anchor_previous.set();
      anchor_next = Raphael("control-next", 37, 37);
      icon_next_set = anchor_next.set();
      icon_stop_set.push(icon1 = anchor_stop.path(icons["cross"]).attr(orange).translate(4, 4), rect1 = anchor_stop.rect(0, 0, 37, 37).attr(none).click(__bind(function() {
        return this.stop();
      }, this)).hover(function() {
        return icon1.stop().animate({
          opacity: 1
        }, 200);
      }).mouseout(function() {
        return icon1.stop().attr({
          opacity: .50
        });
      }));
      icon_replay_set.push(icon2 = anchor_replay.path(icons["refresh"]).attr(fill).translate(4, 4), rect2 = anchor_replay.rect(0, 0, 37, 37).attr(none).click(__bind(function() {
        return this.replay();
      }, this)).hover(function() {
        return icon2.stop().animate({
          opacity: 1
        }, 200);
      }).mouseout(function() {
        return icon2.stop().attr({
          opacity: .20
        });
      }));
      icon_previous_set.push(icon_previous = anchor_previous.path(icons["arrowleftalt"]).attr(green).translate(4, 4), rect_previous = anchor_previous.rect(0, 0, 37, 37).attr(none).click(__bind(function() {
        return this.playPrevious();
      }, this)).hover(function() {
        return icon_previous.stop().animate({
          opacity: 1
        }, 200);
      }).mouseout(function() {
        return icon_previous.stop().attr({
          opacity: .30
        });
      }));
      return icon_next_set.push(icon_next = anchor_next.path(icons["arrowalt"]).attr(green).translate(4, 4), rect_next = anchor_next.rect(0, 0, 37, 37).attr(none).click(__bind(function() {
        return this.playNext();
      }, this)).hover(function() {
        return icon_next.stop().animate({
          opacity: 1
        }, 200);
      }).mouseout(function() {
        return icon_next.stop().attr({
          opacity: .30
        });
      }));
    };
    return Movie;
  })();
  Clip = (function() {
    function Clip(viewport, name, caption, sequential, speed) {
      this.viewport = viewport;
      this.name = name;
      this.caption = caption != null ? caption : "";
      this.sequential = sequential != null ? sequential : true;
      this.speed = speed != null ? speed : BASE_ANIMATE_RATE;
      this.render_queue = [];
      this.render_index = 0;
      this.frames_rendered = 0;
      this.rendered_shapes = [];
      this.rendered_shapes_buffer = [];
    }
    Clip.prototype.reset = function() {
      var ashape, _i, _j, _len, _len2;
      console.log("Pre reset cubes detected: [" + $("#viewport rect").length + "] (two frames full of cubes).");
      if (rendered_shapes_buffer) {
        for (_i = 0, _len = rendered_shapes_buffer.length; _i < _len; _i++) {
          ashape = rendered_shapes_buffer[_i];
          console.log("        -> Removed buffered shape");
          ashape.stop();
          ashape.remove();
        }
      }
      if (rendered_shapes) {
        for (_j = 0, _len2 = rendered_shapes.length; _j < _len2; _j++) {
          ashape = rendered_shapes[_j];
          console.log("        -> Stopping shape");
          /*
          HACK: Mozilla Hack, Opera Hack
          This is the transition backup plan for Mozilla and Opera
          If all else fails, this will solve the issue of some shapes
          being stalled and not being moved in to the buffer right away.
          */
          /*if $.browser.mozilla or $.browser.opera
              ashape.remove()*/
        }
        rendered_shapes_buffer = null;
        rendered_shapes_buffer = rendered_shapes;
        rendered_shapes = null;
        rendered_shapes = [];
      }
      this.render_index = 0;
      this.frames_rendered = 0;
      EventManager.publish("buffers-reset");
      return console.log("Post reset cubes detected: [" + $("#viewport rect").length + "] (cubes sent to the buffer.)");
    };
    Clip.prototype.showCurrentCaption = function(caption_attr) {
      if (caption_attr == null) {
        caption_attr = null;
      }
      if (!caption_attr) {
        caption_attr = {
          font: "68px M1cregular, Arial, sans-serif",
          opacity: 0
        };
      }
      if (rendered_caption) {
        rendered_caption.remove();
        rendered_caption = null;
      }
      if (this.caption.length > 0) {
        rendered_caption = this.viewport.text(425, 100, this.caption).attr(caption_attr);
        rendered_caption.toFront();
        setTimeout((__bind(function() {
          if (rendered_caption) {
            return rendered_caption.animate({
              opacity: 0.75
            }, 250);
          }
        }, this)), 1000);
      }
      return EventManager.publish("clip-caption-shown");
    };
    Clip.prototype.removeCurrentCaption = function() {
      if (rendered_caption) {
        return rendered_caption.animate({
          opacity: 0.0
        }, 150, (__bind(function() {
          if (rendered_caption) {
            rendered_caption.remove();
          }
          return rendered_caption = null;
        }, this)));
      }
    };
    Clip.prototype.play = function(async_render) {
      var frame, _i, _len, _ref, _results;
      if (async_render == null) {
        async_render = true;
      }
      EventManager.subscribe("clip-ended", (__bind(function() {
        return this.showCurrentCaption();
      }, this)));
      if (this.sequential) {
        EventManager.subscribe("frame-ended", (__bind(function() {
          if (this.sequential) {
            this.render_index++;
            if (!async_render) {
              return setTimeout((__bind(function() {
                if (this.render_index < this.render_queue.length) {
                  console.log("Rendering " + this.render_index);
                }
                if (this.render_index < this.render_queue.length) {
                  this.render_queue[this.render_index].render(this.sequential);
                }
                console.log(this.render_index + "of" + this.render_queue.length);
                if (this.render_index === this.render_queue.length) {
                  console.log("Ended.");
                  return EventManager.publish("clip-ended");
                }
              }, this)), 1000);
            } else {
              if (this.render_index < this.render_queue.length) {
                console.log("Rendering " + this.render_index);
              }
              if (this.render_index < this.render_queue.length) {
                this.render_queue[this.render_index].render(this.sequential);
              }
              console.log(this.render_index + "of" + this.render_queue.length);
              if (this.render_index === this.render_queue.length) {
                console.log("Ended.");
                return EventManager.publish("clip-ended");
              }
            }
          }
        }, this)));
        if (this.render_queue[this.render_index]) {
          this.render_queue[this.render_index].render(this.sequential);
        }
      }
      if (!this.sequential) {
        EventManager.subscribe("frame-ended", (__bind(function() {
          if (!this.sequential) {
            this.frames_rendered++;
            if (this.frames_rendered === this.render_queue.length) {
              return EventManager.publish("clip-ended");
            }
          }
        }, this)));
        _ref = this.render_queue;
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          frame = _ref[_i];
          _results.push(!async_render ? setTimeout((__bind(function() {
            frame.render(this.sequential);
            return this.render_index++;
          }, this)), 1000) : (frame.render(this.sequential), this.render_index++));
        }
        return _results;
      }
    };
    return Clip;
  })();
  ShapeClip = (function() {
    __extends(ShapeClip, Clip);
    function ShapeClip(viewport, name, shapes, caption, sequential, animationFx, speed) {
      this.viewport = viewport;
      this.name = name;
      this.shapes = shapes;
      this.caption = caption;
      this.sequential = sequential != null ? sequential : true;
      this.animationFx = animationFx != null ? animationFx : BounceFallAnimation;
      this.speed = speed != null ? speed : BASE_ANIMATE_RATE;
      ShapeClip.__super__.constructor.call(this, this.viewport, this.name, this.caption, this.sequential, this.speed);
      this.render_queue = this.generateClipQueue(this.shapes);
    }
    ShapeClip.prototype.stop = function() {
      /*
      This really doesn't do anything.
      */      var ashape, frame, _i, _j, _len, _len2, _ref;
      _ref = this.render_queue;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        frame = _ref[_i];
        frame.stop();
      }
      if (rendered_shapes) {
        for (_j = 0, _len2 = rendered_shapes.length; _j < _len2; _j++) {
          ashape = rendered_shapes[_j];
          console.log("        -> Stopping shape");
          ashape.stop();
        }
      }
      return this.transition();
    };
    ShapeClip.prototype.rewind = function() {
      var frame, _i, _len, _ref, _results;
      this.render_index = 0;
      this.frames_rendered = 0;
      _ref = this.render_queue;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        frame = _ref[_i];
        _results.push(frame.reset());
      }
      return _results;
    };
    ShapeClip.prototype.transition = function(speed, additive, type) {
      var acube, index, _len, _results;
      if (speed == null) {
        speed = 200;
      }
      if (additive == null) {
        additive = "backOut";
      }
      if (type == null) {
        type = "wipe";
      }
      _results = [];
      for (index = 0, _len = rendered_shapes.length; index < _len; index++) {
        acube = rendered_shapes[index];
        _results.push(type === "wipe" ? acube.animate({
          "100%": {
            x: -150,
            callback: function() {
              EventManager.publish("post-transition");
              /*
              HACK: Mozilla Hack, Opera Hack
              This quickly removes the shapes during the end of the
              transition cycle, so it looks like it's transitioning yet
              right before your eyes some shapes which are lagging
              are actually being removed!
              */
              if ($.browser.mozilla || $.browser.opera) {
                return acube.remove();
              }
            }
          }
        }, speed, additive) : void 0);
      }
      return _results;
    };
    ShapeClip.prototype.character2Generator = function(frames) {
      var col, curr_frame_offset, frame_queue, index, letter, letter_index, matrix, matrix_width, row, spliced_array, temp_array, x, y, _len, _len2, _len3, _len4;
      matrix_width = 4;
      frame_queue = [];
      spliced_array = [];
      curr_frame_offset = 1;
      try {
        for (letter_index = 0, _len = frames.length; letter_index < _len; letter_index++) {
          letter = frames[letter_index];
          if (letter !== ' ') {
            matrix = characters2[letter].matrix;
            for (index = 0, _len2 = matrix.length; index < _len2; index += matrix_width) {
              row = matrix[index];
              temp_array = matrix.slice(index, (index + (matrix_width - 1) + 1) || 9e9);
              spliced_array.push(temp_array);
            }
            spliced_array.reverse();
            for (y = 0, _len3 = spliced_array.length; y < _len3; y++) {
              row = spliced_array[y];
              for (x = 0, _len4 = row.length; x < _len4; x++) {
                col = row[x];
                if (col === 1) {
                  frame_queue.push(new CubeAnimation(this.viewport, 1, 1, x + curr_frame_offset, y + 1, this.animationFx, this.speed));
                }
              }
            }
            spliced_array = 0;
            spliced_array = [];
          }
          curr_frame_offset += characters2[letter].size + 1;
        }
      } catch (error) {
        console.error("Frame:[" + letter + "] could not be found in 'characters2' map. JS error: " + error);
      }
      return frame_queue;
    };
    ShapeClip.prototype.generateClipQueue = function(frames) {
      var curr_frame_offset, frame_queue;
      curr_frame_offset = 0;
      frame_queue = [];
      /*
      TODO: Convert this.
      Note: Here is where I totally bastardized matrices.
            Wanted to see what I could come up with without complexity and
            using the 'tried' usual boring 'way' of doing things (2D).
            I could have done matrice transformations right into a new svg
            obj without any sort of library but that seemed boring.

            This was an exercise in thinking outside the box by actually
            removing the box first.
      */
      for (var letter=0, frames_len = frames.length; letter < frames_len; letter++) {
            try {
                matrix = characters[frames[letter]].matrix

                for(var x=0, len=matrix.length; x< len; x=x+4) {
                    if (letter == 0)
                        frame_queue.push( new CubeAnimation(this.viewport, matrix[x], matrix[x+1], matrix[x+2], matrix[x+3], this.animationFx) )
                    else
                        frame_queue.push( new CubeAnimation(this.viewport, matrix[x], matrix[x+1], matrix[x+2]+curr_frame_offset, matrix[x+3], this.animationFx) )
                }

                console.log("Char size: " + characters[frames[letter]].size)
                curr_frame_offset += characters[frames[letter]].size+1
            } catch (error) {
                console.error("Matrix error processing character frame: [" + frames[letter] + "], internal error: " + error)
            }
        };
      return frame_queue;
    };
    return ShapeClip;
  })();
  Character2ShapeClip = (function() {
    __extends(Character2ShapeClip, ShapeClip);
    function Character2ShapeClip(viewport, name, shapes, caption, sequential, animationFx, speed) {
      this.viewport = viewport;
      this.name = name;
      this.shapes = shapes;
      this.caption = caption;
      this.sequential = sequential != null ? sequential : true;
      this.animationFx = animationFx != null ? animationFx : BounceFallAnimation;
      this.speed = speed != null ? speed : BASE_ANIMATE_RATE;
      this.sequential = true;
      Character2ShapeClip.__super__.constructor.call(this, this.viewport, this.name, this.shapes, this.caption, this.sequential, this.animationFx, this.speed);
      this.render_queue = this.character2Generator(this.shapes);
    }
    Character2ShapeClip.prototype.play = function(async_render) {
      if (async_render == null) {
        async_render = false;
      }
      /*
      You can either control it here programmatically.
          By overriding the default play async_render value.
      Or allow the user to control it by continueing to accept the
      async_render value when calling play.
      */
      return Character2ShapeClip.__super__.play.call(this, async_render);
    };
    return Character2ShapeClip;
  })();
  CubeAnimation = (function() {
    function CubeAnimation(viewport, width, height, x_offset, y_offset, animationFx, speed, cube_size, roundness) {
      this.viewport = viewport;
      this.width = width != null ? width : MAX_CUBES_PER_ROW;
      this.height = height != null ? height : MAX_CUBE_ROWS;
      this.x_offset = x_offset != null ? x_offset : 0;
      this.y_offset = y_offset != null ? y_offset : 1;
      this.animationFx = animationFx != null ? animationFx : BounceFallAnimation;
      this.speed = speed != null ? speed : BASE_ANIMATE_RATE;
      this.cube_size = cube_size != null ? cube_size : SIZE_CUBE;
      this.roundness = roundness != null ? roundness : 5;
      this.cubes = [];
      this.cubes_buffer = [];
      this.curr_cube = 0;
      this.curr_cube_row = this.y_offset;
      this.curr_cube_col = this.x_offset;
      this.curr_matrix_height = this.height + this.y_offset;
      this.curr_matrix_width = this.width + this.x_offset;
    }
    CubeAnimation.prototype.stop = function() {
      console.log("Stop called on frame.");
      this.curr_cube_row = this.height + this.y_offset;
      return this.curr_cube_col = this.width + this.x_offset;
    };
    CubeAnimation.prototype.reset = function() {
      console.log("Reset called on frame.");
      this.cubes = [];
      this.cubes_buffer = [];
      this.curr_cube = 0;
      this.curr_cube_row = this.y_offset;
      return this.curr_cube_col = this.x_offset;
    };
    CubeAnimation.prototype.getRenderedCubes = function() {
      return this.cubes;
    };
    CubeAnimation.prototype.drawCube = function() {
      var cube;
      cube = this.viewport.rect(this.curr_cube_col * this.cube_size, -this.cube_size, this.cube_size, this.cube_size, this.roundness);
      cube.attr({
        fill: "white",
        opacity: 1
      });
      cube.hover((function() {
        return this.rotateBy(+360);
      }), (function() {
        return this.rotateBy(0);
      }));
      cube.mouseout(function() {
        return this.rotateReset();
      });
      cube.click(function() {
        return this.changeColor();
      });
      cube.dblclick(function() {
        return this.attr({
          fill: "white"
        });
      });
      cube.mousedown(function() {
        this.toFront();
        return this.animate({
          scale: "1.5, 1.5"
        }, 500, "elastic");
      });
      cube.mouseup(function() {
        return this.animate({
          scale: "1.0, 1.0"
        }, 500, "bounce");
      });
      return cube;
    };
    CubeAnimation.prototype.animateCube = function(cube, sequential, animationFx, speed) {
      var afx;
      this.speed = speed;
      EventManager.publish("pre-animate");
      EventManager.subscribe("post-animate", (__bind(function() {
        return this.render(sequential);
      }, this)));
      afx = new animationFx();
      return afx.animate(cube, this.curr_cube_row, this.speed);
    };
    CubeAnimation.prototype.render = function(sequential) {
      var error_msg;
      if (sequential == null) {
        sequential = true;
      }
      /*
      This is way too deep to be of any real overflow protection
      Hey at least it will stop... eventuall... ha!
      */
      if (rendered_shapes.length > BUFFER_LIMIT) {
        error_msg = "Buffer went nuts! Cleaning up, pray this wasn't async!";
        this.curr_cube_row = BUFFER_LIMIT;
        this.curr_cube_col = BUFFER_LIMIT;
        this.cubes = [];
        rendered_shapes = [];
        clearAllTimeouts();
        $("viewport rect").remove();
        console.error(error_msg);
        throw error_msg;
      }
      if (this.curr_cube_col <= this.curr_matrix_width && this.curr_cube_row < this.curr_matrix_height) {
        console.log("if");
        this.cube = this.drawCube();
        this.curr_cube++;
        this.curr_cube_col++;
        this.cubes.push(this.cube);
        rendered_shapes.push(this.cube);
        this.animateCube(this.cube, sequential, this.animationFx, this.speed);
      }
      if (this.curr_cube_col === this.curr_matrix_width) {
        console.log("if 2");
        this.curr_cube_col = this.x_offset;
        this.curr_cube_row++;
        console.log("status: " + this.curr_cube_col + "-" + this.curr_matrix_width + "," + this.curr_cube_row + "-" + this.curr_matrix_height);
        if (this.curr_cube_row >= this.curr_matrix_height) {
          EventManager.publish("frame-ended");
        }
      }
      return this.cubes;
    };
    return CubeAnimation;
  })();
  AnimateEffect = (function() {
    function AnimateEffect() {
      this.additive = "<";
    }
    AnimateEffect.prototype.animate = function(rafObj, curr_cube_row, speed) {
      this.rafObj = rafObj;
      this.curr_cube_row = curr_cube_row;
      this.speed = speed != null ? speed : BASE_ANIMATE_RATE;
    };
    return AnimateEffect;
  })();
  LightRaindropAnimation = (function() {
    function LightRaindropAnimation() {
      LightRaindropAnimation.__super__.constructor.apply(this, arguments);
    }
    __extends(LightRaindropAnimation, AnimateEffect);
    LightRaindropAnimation.prototype.animate = function(rafObj, curr_cube_row, speed) {
      var y_rate;
      this.rafObj = rafObj;
      this.curr_cube_row = curr_cube_row;
      this.speed = speed != null ? speed : BASE_ANIMATE_RATE;
      LightRaindropAnimation.__super__.animate.apply(this, arguments);
      this.additive = ">";
      this.rafObj.attr({
        opacity: 0
      });
      y_rate = (Math.floor(Math.random() * 9) + 1) * 100;
      if (this.curr_cube_row === 0) {
        return this.rafObj.animate({
          y: SIZE_VIEWPORT_HEIGHT - SIZE_CUBE
        }, this.speed + y_rate, this.additive, (__bind(function() {
          rafObj.fade();
          return EventManager.publish("post-animate");
        }, this)));
      } else {
        return this.rafObj.animate({
          y: SIZE_VIEWPORT_HEIGHT - (this.curr_cube_row * SIZE_CUBE)
        }, this.speed + y_rate, this.additive, (__bind(function() {
          rafObj.fade();
          return EventManager.publish("post-animate");
        }, this)));
      }
    };
    return LightRaindropAnimation;
  })();
  MaterializeAnimation = (function() {
    function MaterializeAnimation() {
      MaterializeAnimation.__super__.constructor.apply(this, arguments);
    }
    __extends(MaterializeAnimation, AnimateEffect);
    /*
    Case: Extremely High Resolution
    Notes:
        With a limited amount of shapes, FF4 will render fast.
        FF4 will surely crawl with anything up to or more than 20% screen
        coverage for svg elements.

        Opera is fast up to about 25-35% coverage.

        Chrome does great with up to 75-90% coverage. In some cases 100%
        depending on the svg path used.
    */
    MaterializeAnimation.prototype.animate = function(rafObj, curr_cube_row, speed) {
      var y_rate;
      this.rafObj = rafObj;
      this.curr_cube_row = curr_cube_row;
      this.speed = speed != null ? speed : BASE_ANIMATE_RATE;
      MaterializeAnimation.__super__.animate.apply(this, arguments);
      this.additive = ">";
      this.rafObj.attr({
        opacity: 0,
        scale: .1
      });
      y_rate = (Math.floor(Math.random() * 9) + 1) * 100;
      if (this.curr_cube_row === 0) {
        return this.rafObj.animate({
          "25%": {
            y: SIZE_VIEWPORT_HEIGHT - SIZE_CUBE,
            easing: "",
            callback: (function() {
              return EventManager.publish("post-animate");
            })
          },
          "75%": {
            y: SIZE_VIEWPORT_HEIGHT - SIZE_CUBE,
            easing: "",
            scale: 1.5,
            opacity: 0.10,
            callback: (function() {
              rafObj.fade();
              return EventManager.publish("post-animate");
            })
          },
          "100%": {
            y: SIZE_VIEWPORT_HEIGHT - SIZE_CUBE,
            easing: this.additive,
            scale: 1.0,
            opacity: 1,
            callback: (function() {
              return EventManager.publish("post-animate");
            })
          }
        }, 1000);
      } else {
        return this.rafObj.animate({
          "25%": {
            y: SIZE_VIEWPORT_HEIGHT - (this.curr_cube_row * SIZE_CUBE),
            easing: "",
            callback: (function() {
              return EventManager.publish("post-animate");
            })
          },
          "75%": {
            y: SIZE_VIEWPORT_HEIGHT - (this.curr_cube_row * SIZE_CUBE),
            easing: "",
            scale: 1.5,
            opacity: 0.10,
            callback: (function() {
              rafObj.fade();
              return EventManager.publish("post-animate");
            })
          },
          "100%": {
            y: SIZE_VIEWPORT_HEIGHT - (this.curr_cube_row * SIZE_CUBE),
            easing: this.additive,
            scale: 1.0,
            opacity: 1,
            callback: (function() {
              return EventManager.publish("post-animate");
            })
          }
        }, 1000);
      }
    };
    return MaterializeAnimation;
  })();
  GentleFallAnimation = (function() {
    function GentleFallAnimation() {
      GentleFallAnimation.__super__.constructor.apply(this, arguments);
    }
    __extends(GentleFallAnimation, AnimateEffect);
    GentleFallAnimation.prototype.animate = function(rafObj, curr_cube_row, speed) {
      var y_rate;
      this.rafObj = rafObj;
      this.curr_cube_row = curr_cube_row;
      this.speed = speed != null ? speed : BASE_ANIMATE_RATE;
      GentleFallAnimation.__super__.animate.apply(this, arguments);
      this.additive = ">";
      y_rate = (Math.floor(Math.random() * 9) + 1) * 100;
      if (this.curr_cube_row === 0) {
        return this.rafObj.animate({
          y: SIZE_VIEWPORT_HEIGHT - SIZE_CUBE
        }, this.speed + y_rate, this.additive, (__bind(function() {
          return EventManager.publish("post-animate");
        }, this)));
      } else {
        return this.rafObj.animate({
          y: SIZE_VIEWPORT_HEIGHT - (this.curr_cube_row * SIZE_CUBE)
        }, this.speed + y_rate, this.additive, (__bind(function() {
          return EventManager.publish("post-animate");
        }, this)));
      }
    };
    return GentleFallAnimation;
  })();
  BounceFallAnimation = (function() {
    function BounceFallAnimation() {
      BounceFallAnimation.__super__.constructor.apply(this, arguments);
    }
    __extends(BounceFallAnimation, AnimateEffect);
    BounceFallAnimation.prototype.animate = function(rafObj, curr_cube_row, speed) {
      var y_rate;
      this.rafObj = rafObj;
      this.curr_cube_row = curr_cube_row;
      this.speed = speed != null ? speed : BASE_ANIMATE_RATE;
      BounceFallAnimation.__super__.animate.apply(this, arguments);
      this.additive = "bounce";
      y_rate = (Math.floor(Math.random() * 9) + 1) * 100;
      if (this.curr_cube_row === 0) {
        return this.rafObj.animate({
          y: SIZE_VIEWPORT_HEIGHT - SIZE_CUBE
        }, this.speed + y_rate, this.additive, (__bind(function() {
          return EventManager.publish("post-animate");
        }, this)));
      } else {
        return this.rafObj.animate({
          y: SIZE_VIEWPORT_HEIGHT - (this.curr_cube_row * SIZE_CUBE)
        }, this.speed + y_rate, this.additive, (__bind(function() {
          return EventManager.publish("post-animate");
        }, this)));
      }
    };
    return BounceFallAnimation;
  })();
  JelloFallAnimation = (function() {
    function JelloFallAnimation() {
      JelloFallAnimation.__super__.constructor.apply(this, arguments);
    }
    __extends(JelloFallAnimation, AnimateEffect);
    JelloFallAnimation.prototype.animate = function(rafObj, curr_cube_row, speed) {
      var y_rate;
      this.rafObj = rafObj;
      this.curr_cube_row = curr_cube_row;
      this.speed = speed != null ? speed : BASE_ANIMATE_RATE;
      JelloFallAnimation.__super__.animate.apply(this, arguments);
      this.additive = "elastic";
      y_rate = (Math.floor(Math.random() * 9) + 1) * 100;
      if (this.curr_cube_row === 0) {
        return this.rafObj.animate({
          y: SIZE_VIEWPORT_HEIGHT - SIZE_CUBE
        }, this.speed + y_rate, this.additive, (__bind(function() {
          return EventManager.publish("post-animate");
        }, this)));
      } else {
        return this.rafObj.animate({
          y: SIZE_VIEWPORT_HEIGHT - (this.curr_cube_row * SIZE_CUBE)
        }, this.speed + y_rate, this.additive, (__bind(function() {
          return EventManager.publish("post-animate");
        }, this)));
      }
    };
    return JelloFallAnimation;
  })();
  ZoomInAnimation = (function() {
    function ZoomInAnimation() {
      ZoomInAnimation.__super__.constructor.apply(this, arguments);
    }
    __extends(ZoomInAnimation, AnimateEffect);
    ZoomInAnimation.prototype.animate = function(rafObj, curr_cube_row, speed) {
      var y_rate;
      this.rafObj = rafObj;
      this.curr_cube_row = curr_cube_row;
      this.speed = speed != null ? speed : BASE_ANIMATE_RATE;
      ZoomInAnimation.__super__.animate.apply(this, arguments);
      this.additive = "backOut";
      this.rafObj.attr({
        scale: .1
      });
      y_rate = (Math.floor(Math.random() * 9) + 1) * 100;
      if (this.curr_cube_row === 0) {
        return this.rafObj.animate({
          y: SIZE_VIEWPORT_HEIGHT - SIZE_CUBE,
          scale: 1
        }, this.speed + y_rate, this.additive, (__bind(function() {
          return EventManager.publish("post-animate");
        }, this)));
      } else {
        return this.rafObj.animate({
          y: SIZE_VIEWPORT_HEIGHT - (this.curr_cube_row * SIZE_CUBE),
          scale: 1
        }, this.speed + y_rate, this.additive, (__bind(function() {
          return EventManager.publish("post-animate");
        }, this)));
      }
    };
    return ZoomInAnimation;
  })();
  ZoomOutAnimation = (function() {
    function ZoomOutAnimation() {
      ZoomOutAnimation.__super__.constructor.apply(this, arguments);
    }
    __extends(ZoomOutAnimation, AnimateEffect);
    ZoomOutAnimation.prototype.animate = function(rafObj, curr_cube_row, speed) {
      var y_rate;
      this.rafObj = rafObj;
      this.curr_cube_row = curr_cube_row;
      this.speed = speed != null ? speed : BASE_ANIMATE_RATE;
      ZoomOutAnimation.__super__.animate.apply(this, arguments);
      this.additive = "backOut";
      this.rafObj.attr({
        scale: 3
      });
      y_rate = (Math.floor(Math.random() * 9) + 1) * 100;
      if (this.curr_cube_row === 0) {
        return this.rafObj.animate({
          y: SIZE_VIEWPORT_HEIGHT - SIZE_CUBE,
          scale: 1
        }, this.speed + y_rate, this.additive, (__bind(function() {
          return EventManager.publish("post-animate");
        }, this)));
      } else {
        return this.rafObj.animate({
          y: SIZE_VIEWPORT_HEIGHT - (this.curr_cube_row * SIZE_CUBE),
          scale: 1
        }, this.speed + y_rate, this.additive, (__bind(function() {
          return EventManager.publish("post-animate");
        }, this)));
      }
    };
    return ZoomOutAnimation;
  })();
  CardsAnimation = (function() {
    function CardsAnimation() {
      CardsAnimation.__super__.constructor.apply(this, arguments);
    }
    __extends(CardsAnimation, AnimateEffect);
    CardsAnimation.prototype.animate = function(rafObj, curr_cube_row, speed) {
      var y_rate;
      this.rafObj = rafObj;
      this.curr_cube_row = curr_cube_row;
      this.speed = speed != null ? speed : BASE_ANIMATE_RATE;
      CardsAnimation.__super__.animate.apply(this, arguments);
      this.additive = "<";
      this.rafObj.attr({
        scale: 3,
        rotation: 900
      });
      y_rate = (Math.floor(Math.random() * 9) + 1) * 100;
      if (this.curr_cube_row === 0) {
        return this.rafObj.animate({
          y: SIZE_VIEWPORT_HEIGHT - SIZE_CUBE,
          scale: 1,
          rotation: 0
        }, this.speed + y_rate, this.additive, (__bind(function() {
          return EventManager.publish("post-animate");
        }, this)));
      } else {
        return this.rafObj.animate({
          y: SIZE_VIEWPORT_HEIGHT - (this.curr_cube_row * SIZE_CUBE),
          scale: 1,
          rotation: 0
        }, this.speed + y_rate, this.additive, (__bind(function() {
          return EventManager.publish("post-animate");
        }, this)));
      }
    };
    return CardsAnimation;
  })();
  initLogger = function() {
    var console, _base, _base2, _base3, _base4;
    if (LOGGING_ENABLED) {
      if (!window.console) {
        console = {};
      }
      window.console.error = (_base = window.console).error || (_base.error = (function() {}));
      window.console.warn = (_base2 = window.console).warn || (_base2.warn = (function() {}));
      window.console.info = (_base3 = window.console).info || (_base3.info = (function() {}));
      window.console.log = (_base4 = window.console).log || (_base4.log = (function() {}));
      return window.console.log("Logger init.");
    } else {
      window.console = (function() {});
      window.console.error = (function() {});
      window.console.warn = (function() {});
      window.console.info = (function() {});
      return window.console.log = (function() {});
    }
  };
  initRaphaelMods = function() {
    Raphael.el.changeColor = function() {
      if (this.attr("fill") === "red") {
        return this.attr({
          fill: "white"
        });
      } else {
        return this.attr({
          fill: "red"
        });
      }
    };
    Raphael.el.rotateBy = function(amount) {
      return this.animate({
        rotation: amount
      }, 500, "<>");
    };
    Raphael.el.rotateReset = function() {
      return this.rotate(0);
    };
    Raphael.el.getLock = function(k) {
      if (this.locks[k]) {
        return this.locks[k];
      }
    };
    Raphael.el.setLock = function(k) {
      if (!this.locks) {
        this.locks = [];
      }
      if (!this.locks[k] && this.attr(k)) {
        return this.locks[k] = this.attr(k);
      }
    };
    Raphael.el.clearLocks = function(doClear) {
      if (doClear == null) {
        doClear = true;
      }
      if (doClear) {
        this.locks = null;
        return this.locks = [];
      }
    };
    return Raphael.el.fade = function() {
      return this.attr({
        fill: "RGB(5,151,242)",
        opacity: .25
      }).animate({
        fill: "white",
        opacity: 1.0
      }, 500);
    };
  };
  initMovie = function() {
    var myMovie, viewport;
    viewport = Raphael("viewport", SIZE_VIEWPORT_WIDTH, SIZE_VIEWPORT_HEIGHT);
    myMovie = new Movie("Text animation", viewport, "example");
    myMovie.addClip(new ShapeClip(viewport, "1", " AA", "Jello", true, JelloFallAnimation, 50));
    myMovie.addClip(new Character2ShapeClip(viewport, "2", "A A", "Cards", true, CardsAnimation));
    myMovie.addClip(new ShapeClip(viewport, "3", "C", "Zoom Out", true, ZoomOutAnimation));
    myMovie.addClip(new ShapeClip(viewport, "4", "C", "Light Rain Drops", true, LightRaindropAnimation));
    myMovie.addClip(new ShapeClip(viewport, "5", "AA", "Zoom In", true, ZoomInAnimation));
    myMovie.addClip(new ShapeClip(viewport, "6", "ABC 5", "Materialize", true, MaterializeAnimation));
    myMovie.addClip(new ShapeClip(viewport, "7", "CC", "Bounce Fall", true));
    return myMovie.play();
  };
  init = function() {
    initLogger();
    initRaphaelMods();
    return initMovie();
  };
  $(document).ready(init);
}).call(this);
