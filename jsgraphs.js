var jsgraphs = jsgraphs || {};
! function(t) {
    t.less = function(t, i, s) { return s(t, i) < 0 }, t.exchange = function(t, i, s) {
        var r = t[i];
        t[i] = t[s], t[s] = r
    };
    var i = function(t) { this.value = t, this.next = null };
    t.StackNode = i;
    var s = function() { this.N = 0, this.first = null };
    s.prototype.push = function(t) { this.first = this._push(this.first, t) }, s.prototype._push = function(i, s) { if (null == i) return this.N++, new t.StackNode(s); var r = i; return this.N++, i = new t.StackNode(s), i.next = r, i }, s.prototype.pop = function() {
        if (null != this.first) {
            var t = this.first,
                i = t.value;
            return this.first = t.next, this.N--, i
        }
    }, s.prototype.size = function() { return this.N }, s.prototype.isEmpty = function() { return 0 == this.N }, s.prototype.peep = function() { if (null != this.first) return this.first.value }, s.prototype.toArray = function() { var t = []; for (x = this.first; null != x;) t.push(x.value), x = x.next; return t }, t.Stack = s;
    var r = function(t) { this.value = t, this.next = null };
    t.QueueNode = r;
    var e = function() { this.first = null, this.last = null, this.N = 0 };
    e.prototype.enqueue = function(i) {
        var s = this.last;
        this.last = new t.QueueNode(i), null != s && (s.next = this.last), null == this.first && (this.first = this.last), this.N++
    }, e.prototype.dequeue = function() {
        if (null != this.first) {
            var t = this.first,
                i = t.value;
            return this.first = t.next, null == this.first && (this.last = null), this.N--, i
        }
    }, e.prototype.size = function() { return this.N }, e.prototype.isEmpty = function() { return 0 == this.N }, e.prototype.toArray = function() { for (var t = [], i = this.first; null != i;) t.push(i.value), i = i.next; return t }, t.Queue = e;
    var o = function(t) { this.s = [], this.N = 0, t || (t = function(t, i) { return t - i }), this.compare = t };
    o.prototype.enqueue = function(t) {
        for (; this.s.lengh <= this.N + 1;) this.s.push(0);
        this.s[++this.N] = t, this.swim(this.N)
    }, o.prototype.swim = function(i) {
        for (; i > 1;) {
            var s = Math.floor(i / 2);
            if (!t.less(this.s[i], this.s[s], this.compare)) break;
            t.exchange(this.s, i, s), i = s
        }
    }, o.prototype.delMin = function() { if (0 != this.N) { var i = this.s[1]; return t.exchange(this.s, 1, this.N--), this.sink(1), i } }, o.prototype.sink = function(i) {
        for (; 2 * i <= this.N;) {
            var s = 2 * i;
            if (s < this.N && t.less(this.s[s + 1], this.s[s], this.compare) && s++, !t.less(this.s[s], this.s[i], this.compare)) break;
            t.exchange(this.s, s, i), i = s
        }
    }, o.prototype.size = function() { return this.N }, o.prototype.isEmpty = function() { return 0 == this.N }, t.MinPQ = o;
    var h = function(t) { this.id = []; for (var i = 0; i < t; ++i) this.id.push(i) };
    h.prototype.union = function(t, i) {
        var s = this.root(t),
            r = this.root(i);
        r != s && (this.id[r] = s)
    }, h.prototype.root = function(t) { for (; this.id[t] != t;) t = this.id[t]; return t }, h.prototype.connected = function(t, i) { return this.root(t) == this.root(i) }, t.QuickUnion = h;
    var n = function(t, i) {
        this.keys = [], this.pq = [], this.qp = [];
        for (var s = 0; s <= t; ++s) this.keys.push(null), this.pq.push(0), this.qp.push(-1);
        this.N = 0, i || (i = function(t, i) { return t - i }), this.compare = i
    };
    n.prototype.insert = function(t, i) { this.keys[t] = i, this.pq[++this.N] = t, this.qp[t] = this.N, this.swim(this.N) }, n.prototype.decreaseKey = function(i, s) { t.less(s, this.keys[i], this.compare) && (this.keys[i] = s, this.swim(this.qp[i])) }, n.prototype.minKey = function() { return this.keys[this.pq[1]] }, n.prototype.min = function() { return this.pq[1] }, n.prototype.delMin = function() { var i = this.pq[1]; return t.exchange(this.pq, 1, this.N), this.qp[this.pq[1]] = 1, this.qp[this.pq[this.N]] = -1, this.keys[this.pq[this.N]] = null, this.N--, this.sink(1), i }, n.prototype.swim = function(i) {
        for (; i > 1;) {
            var s = Math.floor(i / 2);
            if (!t.less(this.keys[this.pq[i]], this.keys[this.pq[s]], this.compare)) break;
            t.exchange(this.pq, i, s), this.qp[this.pq[i]] = i, this.qp[this.pq[s]] = s, i = s
        }
    }, n.prototype.sink = function(i) {
        for (; 2 * i <= this.N;) {
            var s = 2 * i;
            if (s < this.N && t.less(this.keys[this.pq[s + 1]], this.keys[this.pq[s]], this.compare) && s++, !t.less(this.keys[this.pq[s]], this.keys[this.pq[i]], this.compare)) break;
            t.exchange(this.pq, i, s), this.qp[this.pq[i]] = i, this.qp[this.pq[s]] = s, i = s
        }
    }, n.prototype.containsIndex = function(t) { return -1 != this.qp[t] }, n.prototype.isEmpty = function() { return 0 == this.N }, n.prototype.size = function() { return this.N }, t.IndexMinPQ = n;
    var a = function(t) { this.V = t, this.adjList = [], this.nodeInfo = [], this.edges = {}; for (var i = 0; i < t; ++i) this.adjList.push([]), this.nodeInfo.push({}) };
    a.prototype.addEdge = function(i, s) {
        this.adjList[i].push(s), this.adjList[s].push(i);
        var r = i + "_" + s;
        i > s && (r = s + "_" + i), this.edges[r] = new t.Edge(i, s, 0)
    }, a.prototype.adj = function(t) { return this.adjList[t] }, a.prototype.node = function(t) { return this.nodeInfo[t] }, a.prototype.edge = function(t, i) { var s = t + "_" + i; return t > i && (s = i + "_" + t), s in this.edges ? this.edges[s] : null }, t.Graph = a;
    var u = function(t) { this.V = t, this.adjList = [], this.nodeInfo = [], this.edges = {}; for (var i = 0; i < t; ++i) this.adjList.push([]), this.nodeInfo.push({}) };
    u.prototype.addEdge = function(i, s) {
        this.adjList[i].push(s);
        var r = i + "_" + s;
        this.edges[r] = new t.Edge(i, s, 0)
    }, u.prototype.edge = function(t, i) { var s = t + "_" + i; return s in this.edges ? this.edges[s] : null }, u.prototype.adj = function(t) { return this.adjList[t] }, u.prototype.node = function(t) { return this.nodeInfo[t] }, u.prototype.reverse = function() {
        for (var t = new u(this.V), i = 0; i < this.V; ++i)
            for (var s = this.adjList[i], r = 0; r < s.length; ++r) {
                var e = s[r];
                t.addEdge(e, i)
            }
        return t
    }, t.DiGraph = u;
    var p = function(t, i, s) { this.v = t, this.w = i, this.weight = s };
    p.prototype.either = function() { return this.v }, p.prototype.other = function(t) { return t == this.v ? this.w : this.v }, p.prototype.from = function() { return this.v }, p.prototype.to = function() { return this.w }, t.Edge = p;
    var d = function(t) { this.V = t, this.adjList = [], this.nodeInfo = []; for (var i = 0; i < t; ++i) this.adjList.push([]), this.nodeInfo.push({}) };
    d.prototype.adj = function(t) { return this.adjList[t] }, d.prototype.edge = function(t, i) {
        for (var s = this.adjList[t], r = 0; r < s.length; ++r)
            if (s[r].other(t) == i) return s[r];
        return null
    }, d.prototype.node = function(t) { return this.nodeInfo[t] }, d.prototype.addEdge = function(t) {
        var i = t.either(),
            s = t.other(i);
        this.adjList[i].push(t), this.adjList[s].push(t)
    }, t.WeightedGraph = d;
    var f = function(t) { d.call(this, t) };
    (f.prototype = Object.create(t.WeightedGraph.prototype)).addEdge = function(t) {
        var i = t.from();
        this.adjList[i].push(t)
    }, f.prototype.edge = function(t, i) {
        for (var s = this.adjList[t], r = 0; r < s.length; ++r)
            if (s[r].other(t) == i) return s[r];
        return null
    }, f.prototype.toDiGraph = function() {
        for (var i = new t.DiGraph(this.V), s = 0; s < this.V; ++s)
            for (var r = this.adjList[s], e = 0; e < r.length; ++e) {
                var o = r[e].other(s);
                i.addEdge(s, o)
            }
        return i
    }, t.WeightedDiGraph = f;
    var c = function(t, i, s) { this.v = t, this.w = i, this.capacity = s, this.flow = 0 };
    c.prototype.residualCapacityTo = function(t) { return t == this.v ? this.flow : this.capacity - this.flow }, c.prototype.addResidualFlowTo = function(t, i) { t == this.v ? this.flow -= i : t == this.w && (this.flow += i) }, c.prototype.from = function() { return this.v }, c.prototype.to = function() { return this.w }, c.prototype.other = function(t) { return t == this.v ? this.w : this.v }, t.FlowEdge = c;
    var v = function(t) { this.V = t, this.adjList = [], this.nodeInfo = []; for (var i = 0; i < t; ++i) this.adjList.push([]), this.nodeInfo.push({}) };
    v.prototype.node = function(t) { return this.nodeInfo[t] }, v.prototype.edge = function(t, i) {
        for (var s = this.adjList[t], r = 0; r < s.length; ++r)
            if (s[r].other(t) == i) return s[r];
        return null
    }, v.prototype.addEdge = function(t) {
        var i = t.from();
        this.adjList[i].push(t);
        var s = t.other(i);
        this.adjList[s].push(t)
    }, v.prototype.adj = function(t) { return this.adjList[t] }, t.FlowNetwork = v;
    var l = function(t, i) {
        this.s = i;
        var s = t.V;
        this.marked = [], this.edgeTo = [];
        for (var r = 0; r < s; ++r) this.marked.push(!1), this.edgeTo.push(-1);
        this.dfs(t, i)
    };
    l.prototype.dfs = function(t, i) {
        this.marked[i] = !0;
        for (var s = t.adj(i), r = 0; r < s.length; ++r) {
            var e = s[r];
            this.marked[e] || (this.edgeTo[e] = i, this.dfs(t, e))
        }
    }, l.prototype.hasPathTo = function(t) { return this.marked[t] }, l.prototype.pathTo = function(i) { var s = new t.Stack; if (i == this.s) return [i]; for (var r = i; r != this.s; r = this.edgeTo[r]) s.push(r); return s.push(this.s), s.toArray() }, t.DepthFirstSearch = l;
    var y = function(i, s) {
        var r = i.V;
        this.s = s;
        var e = new t.Queue;
        e.enqueue(s), this.marked = [], this.edgeTo = [];
        for (o = 0; o < r; ++o) this.marked.push(!1), this.edgeTo.push(-1);
        for (; !e.isEmpty();) {
            var o = e.dequeue();
            this.marked[o] = !0;
            for (var h = i.adj(o), n = 0; n < h.length; ++n) {
                var a = h[n];
                this.marked[a] || (this.edgeTo[a] = o, e.enqueue(a))
            }
        }
    };
    y.prototype.hasPathTo = function(t) { return this.marked[t] }, y.prototype.pathTo = function(i) { var s = new t.Stack; if (i == this.s) return [i]; for (var r = i; r != this.s; r = this.edgeTo[r]) s.push(r); return s.push(this.s), s.toArray() }, t.BreadthFirstSearch = y;
    var m = function(t) {
        this.count = 0;
        var i = t.V;
        this.marked = [], this.id = [];
        for (s = 0; s < i; ++s) this.marked.push(!1), this.id.push(-1);
        for (var s = 0; s < i; ++s) this.marked[s] || (this.dfs(t, s), this.count++)
    };
    m.prototype.dfs = function(t, i) {
        this.marked[i] = !0, this.id[i] = this.count;
        for (var s = t.adj(i), r = 0; r < s.length; ++r) {
            var e = s[r];
            this.marked[e] || this.dfs(t, e)
        }
    }, m.prototype.componentId = function(t) { return this.id[t] }, m.prototype.componentCount = function() { return this.count }, t.ConnectedComponents = m;
    var g = function(i) { this.postOrder = new t.Stack, this.marked = []; for (var s = i.V, r = 0; r < s; ++r) this.marked.push(!1); for (r = 0; r < s; ++r) this.marked[r] || this.dfs(i, r) };
    g.prototype.dfs = function(t, i) {
        this.marked[i] = !0;
        for (var s = t.adj(i), r = 0; r < s.length; ++r) {
            var e = s[r];
            this.marked[e] || this.dfs(t, e)
        }
        this.postOrder.push(i)
    }, g.prototype.order = function() { return this.postOrder.toArray() }, t.TopologicalSort = g;
    var k = function(i) {
        var s = i.V;
        this.count = 0, this.marked = [], this.id = [];
        for (o = 0; o < s; ++o) this.marked.push(!1), this.id.push(-1);
        for (var r = new t.TopologicalSort(i.reverse()).order(), e = 0; e < r.length; ++e) {
            var o = r[e];
            this.marked[o] || (this.dfs(i, o), this.count++)
        }
    };
    k.prototype.dfs = function(t, i) {
        this.marked[i] = !0, this.id[i] = this.count;
        for (var s = t.adj(i), r = 0; r < s.length; ++r) {
            var e = s[r];
            this.marked[e] || this.dfs(t, e)
        }
    }, k.prototype.componentId = function(t) { return this.id[t] }, k.prototype.componentCount = function() { return this.count }, t.StronglyConnectedComponents = k;
    var q = function(i) {
        for (var s = i.V, r = new t.MinPQ(function(t, i) { return t.weight - i.weight }), e = 0; e < i.V; ++e)
            for (var o = i.adj(e), h = 0; h < o.length; ++h)(a = o[h]).either() == e && r.enqueue(a);
        this.mst = [];
        for (var n = new t.QuickUnion(s); !r.isEmpty() && this.mst.length < s - 1;) {
            var a = r.delMin(),
                e = a.either(),
                u = a.other(e);
            n.connected(e, u) || (n.union(e, u), this.mst.push(a))
        }
    };
    t.KruskalMST = q;
    var w = function(i) {
        var s = i.V;
        this.marked = [];
        for (e = 0; e < s; ++e) this.marked.push(!1);
        for (this.pq = new t.MinPQ(function(t, i) { return t.weight - i.weight }), this.mst = [], this.visit(i, 0); !this.pq.isEmpty() && this.mst.length < s - 1;) {
            var r = this.pq.delMin(),
                e = r.either(),
                o = r.other(e);
            this.marked[e] && this.marked[o] || (this.mst.push(r), this.marked[e] || this.visit(i, e), this.marked[o] || this.visit(i, o))
        }
    };
    w.prototype.visit = function(t, i) {
        this.marked[i] = !0;
        for (var s = t.adj(i), r = 0; r < s.length; ++r) {
            var e = s[r];
            this.marked[e.other(i)] || this.pq.enqueue(e)
        }
    }, t.LazyPrimMST = w;
    var T = function(i) {
        var s = i.V;
        this.pq = new t.IndexMinPQ(s, function(t, i) { return t.weight - i.weight }), this.marked = [];
        for (var r = 0; r < s; ++r) this.marked.push(!1);
        for (this.mst = [], this.visit(i, 0); !this.pq.isEmpty();) {
            var e = this.pq.minKey(),
                o = this.pq.delMin();
            this.mst.push(e), this.marked[o] || this.visit(i, o)
        }
    };
    T.prototype.visit = function(t, i) {
        this.marked[i] = !0;
        for (var s = t.adj(i), r = 0; r < s.length; ++r) {
            var e = s[r],
                o = e.other(i);
            this.marked[o] || (this.pq.containsIndex(o) ? this.pq.decreaseKey(o, e) : this.pq.insert(o, e))
        }
    }, t.EagerPrimMST = T;
    var j = function(i, s) {
        var r = i.V;
        this.s = s, this.marked = [], this.edgeTo = [], this.cost = [], this.pq = new t.IndexMinPQ(r, function(t, i) { return i });
        for (e = 0; e < r; ++e) this.marked.push(!1), this.edgeTo.push(null), this.cost.push(Number.MAX_VALUE);
        for (this.cost[s] = 0, this.pq.insert(s, this.cost[s]); !this.pq.isEmpty();) {
            var e = this.pq.delMin();
            this.marked[e] = !0;
            for (var o = i.adj(e), h = 0; h < o.length; ++h) {
                var n = o[h];
                this.relax(n)
            }
        }
    };
    j.prototype.relax = function(t) {
        var i = t.from(),
            s = t.to();
        this.cost[s] > this.cost[i] + t.weight && (this.cost[s] = this.cost[i] + t.weight, this.edgeTo[s] = t, this.pq.containsIndex(s) ? this.pq.decreaseKey(s, this.cost[s]) : this.pq.insert(s, this.cost[s]))
    }, j.prototype.hasPathTo = function(t) { return this.marked[t] }, j.prototype.pathTo = function(i) { for (var s = new t.Stack, r = i; r != this.s; r = this.edgeTo[r].other(r)) s.push(this.edgeTo[r]); return s.toArray() }, j.prototype.distanceTo = function(t) { return this.cost[t] }, t.Dijkstra = j;
    var N = function(t, i) {
        var s = t.V;
        this.s = i, this.marked = [], this.edgeTo = [], this.cost = [];
        for (e = 0; e < s; ++e) this.marked.push(!1), this.edgeTo.push(null), this.cost.push(Number.MAX_VALUE);
        this.cost[i] = 0, this.marked[i] = !0;
        for (var r = 0; r < s; ++r)
            for (var e = 0; e < s; ++e)
                for (var o = t.adj(e), h = 0; h < o.length; ++h) {
                    var n = o[h];
                    this.relax(n)
                }
    };
    N.prototype.relax = function(t) {
        var i = t.from(),
            s = t.to();
        this.cost[s] > this.cost[i] + t.weight && (this.cost[s] = this.cost[i] + t.weight, this.marked[s] = !0, this.edgeTo[s] = t)
    }, N.prototype.hasPathTo = function(t) { return this.marked[t] }, N.prototype.pathTo = function(i) { for (var s = new t.Stack, r = i; r != this.s; r = this.edgeTo[r].other(r)) s.push(this.edgeTo[r]); return s.toArray() }, N.prototype.distanceTo = function(t) { return this.cost[t] }, t.BellmanFord = N;
    var L = function(i, s) {
        var r = i.V;
        this.s = s, this.marked = [], this.edgeTo = [], this.cost = [];
        for (h = 0; h < r; ++h) this.marked.push(!1), this.edgeTo.push(null), this.cost.push(Number.MAX_VALUE);
        this.cost[s] = 0, this.marked[s] = !0;
        for (var e = new t.TopologicalSort(i.toDiGraph()).order(), o = 0; o < e.length; ++o)
            for (var h = e[o], n = i.adj(h), a = 0; a < n.length; ++a) {
                var u = n[a];
                this.relax(u)
            }
    };
    L.prototype.relax = function(t) {
        var i = t.from(),
            s = t.to();
        this.cost[s] > this.cost[i] + t.weight && (this.cost[s] = this.cost[i] + t.weight, this.marked[s] = !0, this.edgeTo[s] = t)
    }, L.prototype.hasPathTo = function(t) { return this.marked[t] }, L.prototype.pathTo = function(i) { for (var s = new t.Stack, r = i; r != this.s; r = this.edgeTo[r].other(r)) s.push(this.edgeTo[r]); return s.toArray() }, L.prototype.distanceTo = function(t) { return this.cost[t] }, t.TopologicalSortShortestPaths = L;
    var V = function(t, i, s) {
        this.value = 0;
        t.V;
        var r = Number.MAX_VALUE;
        for (this.marked = null, this.edgeTo = null, this.s = i, this.t = s; this.hasAugmentedPath(t);) {
            for (e = this.t; e != this.s; e = this.edgeTo[e].other(e)) r = Math.min(r, this.edgeTo[e].residualCapacityTo(e));
            for (var e = this.t; e != this.s; e = this.edgeTo[e].other(e)) this.edgeTo[e].addResidualFlowTo(e, r);
            this.value += r
        }
    };
    V.prototype.hasAugmentedPath = function(i) {
        var s = i.V;
        this.marked = [], this.edgeTo = [];
        for (e = 0; e < s; ++e) this.marked.push(!1), this.edgeTo.push(null);
        var r = new t.Queue;
        for (r.enqueue(this.s), this.marked[this.s] = !0; !r.isEmpty();)
            for (var e = r.dequeue(), o = i.adj(e), h = 0; h < o.length; ++h) {
                var n = o[h],
                    a = n.other(e);
                if (!this.marked[a] && n.residualCapacityTo(a) > 0) {
                    if (this.edgeTo[a] = n, this.marked[a] = !0, a == this.t) return !0;
                    r.enqueue(a)
                }
            }
        return !1
    }, V.prototype.minCut = function(t) {
        for (var i = [], s = t.V, r = 0; r < s; ++r)
            for (var e = t.adj(r), o = 0; o < e.length; ++o) {
                var h = e[o];
                h.from() == r && 0 == h.residualCapacityTo(h.other(r)) && i.push(h)
            }
        return i
    }, t.FordFulkerson = V
}(jsgraphs);
export default jsgraphs;