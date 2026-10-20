extends SceneTree
# Lab helper (not committed): prints an ASCII tile map. Args: cx cz half step
func _init() -> void:
	var a := OS.get_cmdline_user_args()
	var cx := int(a[0]); var cz := int(a[1]); var half := int(a[2]); var step := int(a[3])
	var store := OgChunkStore.new(1)
	var ch := ".,:#^~=@"
	for z in range(cz - half, cz + half, step):
		var line := "%5d " % z
		for x in range(cx - half, cx + half, step):
			line += ch[store.tile_at(x, z)]
		print(line)
	quit()
