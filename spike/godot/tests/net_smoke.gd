# ENet multiplayer smoke test: two headless Godot processes on localhost.
#   godot --headless --path spike/godot --script res://tests/net_smoke.gd -- --host
#   godot --headless --path spike/godot --script res://tests/net_smoke.gd -- --client
# The host moves /root/Mover; a MultiplayerSynchronizer replicates its position.
# The client passes (exit 0) once it has seen the node move past x = 1.0 with >= 10 distinct updates.
extends SceneTree

const PORT := 24567
const TIMEOUT_S := 20.0

var is_host := false
var mover: Node3D
var elapsed := 0.0
var seen: Dictionary = {}
var client_seen := false
var mp: MultiplayerAPI


func _initialize() -> void:
	is_host = OS.get_cmdline_user_args().has("--host")
	mp = get_multiplayer()
	mover = Node3D.new()
	mover.name = "Mover"
	var sync := MultiplayerSynchronizer.new()
	sync.name = "Sync"
	var cfg := SceneReplicationConfig.new()
	cfg.add_property(NodePath(".:position"))
	cfg.property_set_replication_mode(NodePath(".:position"), SceneReplicationConfig.REPLICATION_MODE_ALWAYS)
	sync.replication_config = cfg
	sync.replication_interval = 0.05
	mover.add_child(sync)
	sync.root_path = NodePath("..")
	root.add_child(mover)

	var peer := ENetMultiplayerPeer.new()
	var err: int
	if is_host:
		err = peer.create_server(PORT, 1)
		mp.peer_connected.connect(func(id: int) -> void: print("[host] peer connected ", id); client_seen = true)
		mp.peer_disconnected.connect(func(id: int) -> void:
			print("[host] peer disconnected ", id, " -> done")
			quit(0))
	else:
		err = peer.create_client("127.0.0.1", PORT)
		mp.connected_to_server.connect(func() -> void: print("[client] connected, my id ", mp.get_unique_id()))
		mp.connection_failed.connect(func() -> void:
			printerr("[client] connection failed")
			quit(1))
	if err != OK:
		printerr("ENet create failed: ", error_string(err))
		quit(1)
		return
	mp.multiplayer_peer = peer
	print("[%s] up on port %d" % ["host" if is_host else "client", PORT])


func _process(delta: float) -> bool:
	elapsed += delta
	if elapsed > TIMEOUT_S:
		printerr("[%s] TIMEOUT after %.1fs (seen %d updates, x=%.2f)" % ["host" if is_host else "client", elapsed, seen.size(), mover.position.x])
		quit(1)
		return false
	if is_host:
		if client_seen:
			mover.position.x += delta  # 1 m/s, only the authority moves it
	else:
		var x := snappedf(mover.position.x, 0.0001)
		if x != 0.0 and not seen.has(x):
			seen[x] = true
			if seen.size() % 10 == 1:
				print("[client] received x=%.3f (%d distinct updates)" % [x, seen.size()])
		if mover.position.x > 1.0 and seen.size() >= 10:
			print("[client] PASS: node synced, x=%.3f after %d distinct updates in %.2fs" % [mover.position.x, seen.size(), elapsed])
			mp.multiplayer_peer.close()
			quit(0)
	return false
