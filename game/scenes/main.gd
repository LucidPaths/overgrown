extends Node3D
## G0 scaffold scene. Capture mode: godot --path game -- --capture <png> [--frames N]
## renders N warm-up frames (default 5), saves the viewport to the PNG and quits with 0.
## A watchdog quits with 2 after CAPTURE_TIMEOUT_S so a pipeline never hangs.

const DEFAULT_WARMUP_FRAMES := 5
const CAPTURE_TIMEOUT_S := 60.0

@onready var _label: Label = $Hud/Label


func _ready() -> void:
	_label.text = "overgrown: G0 scaffold\nv%s" % GameVersion.VERSION
	var args := OS.get_cmdline_user_args()
	var i := args.find("--capture")
	if i < 0:
		return
	if i + 1 >= args.size():
		printerr("--capture needs a PNG path")
		get_tree().quit(2)
		return
	var frames := DEFAULT_WARMUP_FRAMES
	var j := args.find("--frames")
	if j >= 0:
		if j + 1 >= args.size() or not args[j + 1].is_valid_int():
			printerr("--frames needs an integer")
			get_tree().quit(2)
			return
		frames = args[j + 1].to_int()
	_capture(args[i + 1], frames)


func _capture(path: String, frames: int) -> void:
	get_tree().create_timer(CAPTURE_TIMEOUT_S).timeout.connect(func() -> void:
		printerr("CAPTURE TIMEOUT")
		get_tree().quit(2))
	for k in frames:
		await RenderingServer.frame_post_draw
	var err := DirAccess.make_dir_recursive_absolute(path.get_base_dir())
	if err != OK:
		printerr("cannot create the directory for %s (error %d)" % [path, err])
		get_tree().quit(1)
		return
	err = get_viewport().get_texture().get_image().save_png(path)
	if err != OK:
		printerr("cannot save %s (error %d)" % [path, err])
		get_tree().quit(1)
		return
	print("CAPTURE ", path)
	get_tree().quit(0)
