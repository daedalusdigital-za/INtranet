using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace ProjectTracker.API.Services.Flows
{
    /// <summary>
    /// Tiny, safe templating + expression language used by Flow steps.
    ///  • Templates: "Missing POD for {{entity.waybillNo}} ({{entity.customerName}})"
    ///  • Expressions: "{{entity.ageHours}} >= 24 && {{entity.status}} == 'DELIVERED'"
    ///    Supports literals ('text', 12, true/false/null), paths, == != &lt; &lt;= &gt; &gt;=,
    ///    contains / startsWith, in [..], ! && || and parentheses, exists(path), empty(path).
    /// No code execution, no reflection — only lookups into the run context.
    /// </summary>
    public static class FlowExpressions
    {
        private static readonly Regex Mustache = new(@"\{\{\s*([^}]+?)\s*\}\}", RegexOptions.Compiled);

        /// <summary>Resolve a dotted path (supports [index] and numeric segments) inside a JSON node.</summary>
        public static JsonNode? Resolve(JsonNode? root, string path)
        {
            if (root == null || string.IsNullOrWhiteSpace(path)) return null;
            var node = root;
            foreach (var raw in path.Replace("[", ".").Replace("]", "").Split('.', StringSplitOptions.RemoveEmptyEntries))
            {
                if (node == null) return null;
                var seg = raw.Trim();
                if (node is JsonObject obj)
                {
                    // case-insensitive key lookup
                    var key = obj.Select(kv => kv.Key).FirstOrDefault(k => string.Equals(k, seg, StringComparison.OrdinalIgnoreCase));
                    node = key == null ? null : obj[key];
                }
                else if (node is JsonArray arr && int.TryParse(seg, out var idx))
                {
                    node = idx >= 0 && idx < arr.Count ? arr[idx] : null;
                }
                else return null;
            }
            return node;
        }

        public static string? ResolveString(JsonNode? root, string path)
        {
            var n = Resolve(root, path);
            return n == null ? null : NodeToString(n);
        }

        public static string NodeToString(JsonNode? n)
        {
            if (n == null) return "";
            if (n is JsonValue v)
            {
                if (v.TryGetValue<string>(out var s)) return s;
                if (v.TryGetValue<bool>(out var b)) return b ? "true" : "false";
                if (v.TryGetValue<double>(out var d)) return d.ToString("0.####", CultureInfo.InvariantCulture);
                if (v.TryGetValue<DateTime>(out var dt)) return dt.ToString("yyyy-MM-dd HH:mm");
                return v.ToJsonString().Trim('"');
            }
            return n.ToJsonString();
        }

        /// <summary>Replace every {{path}} with its value from the context. Unknown paths become empty.</summary>
        public static string Render(string? template, JsonNode? context)
        {
            if (string.IsNullOrEmpty(template)) return template ?? "";
            return Mustache.Replace(template, m => ResolveString(context, m.Groups[1].Value) ?? "");
        }

        /// <summary>Evaluate a boolean expression. Returns false on any error (and sets error).</summary>
        public static bool Evaluate(string? expression, JsonNode? context, out string? error)
        {
            error = null;
            if (string.IsNullOrWhiteSpace(expression)) return true;
            try
            {
                var parser = new Parser(expression, context);
                var result = parser.ParseExpression();
                parser.ExpectEnd();
                return Truthy(result);
            }
            catch (Exception ex)
            {
                error = ex.Message;
                return false;
            }
        }

        public static bool Truthy(object? v) => v switch
        {
            null => false,
            bool b => b,
            string s => !string.IsNullOrWhiteSpace(s) && s != "false" && s != "0",
            double d => d != 0,
            JsonArray a => a.Count > 0,
            JsonObject o => o.Count > 0,
            _ => true
        };

        // ── Parser ─────────────────────────────────────────────────────────────────────
        private sealed class Parser
        {
            private readonly string _s;
            private readonly JsonNode? _ctx;
            private int _i;

            public Parser(string s, JsonNode? ctx) { _s = s; _ctx = ctx; }

            public void ExpectEnd()
            {
                SkipWs();
                if (_i < _s.Length) throw new Exception($"Unexpected '{_s.Substring(_i)}' at {_i}");
            }

            public object? ParseExpression() => ParseOr();

            private object? ParseOr()
            {
                var left = ParseAnd();
                while (Match("||") || MatchWord("or")) { var right = ParseAnd(); left = Truthy(left) || Truthy(right); }
                return left;
            }

            private object? ParseAnd()
            {
                var left = ParseNot();
                while (Match("&&") || MatchWord("and")) { var right = ParseNot(); left = Truthy(left) && Truthy(right); }
                return left;
            }

            private object? ParseNot()
            {
                SkipWs();
                if (Match("!") || MatchWord("not")) return !Truthy(ParseNot());
                return ParseComparison();
            }

            private object? ParseComparison()
            {
                var left = ParsePrimary();
                SkipWs();
                string[] ops = { "==", "!=", ">=", "<=", ">", "<" };
                foreach (var op in ops)
                {
                    if (Match(op))
                    {
                        var right = ParsePrimary();
                        return Compare(left, right, op);
                    }
                }
                if (MatchWord("contains")) { var r = ParsePrimary(); return Str(left).Contains(Str(r), StringComparison.OrdinalIgnoreCase); }
                if (MatchWord("startswith")) { var r = ParsePrimary(); return Str(left).StartsWith(Str(r), StringComparison.OrdinalIgnoreCase); }
                if (MatchWord("in"))
                {
                    var r = ParsePrimary();
                    if (r is List<object?> list) return list.Any(x => Compare(left, x, "==") is true);
                    if (r is JsonArray arr) return arr.Any(x => Compare(left, Unwrap(x), "==") is true);
                    return Str(r).Contains(Str(left), StringComparison.OrdinalIgnoreCase);
                }
                return left;
            }

            private object? ParsePrimary()
            {
                SkipWs();
                if (_i >= _s.Length) throw new Exception("Unexpected end of expression");
                var c = _s[_i];

                if (c == '(')
                {
                    _i++;
                    var v = ParseExpression();
                    SkipWs();
                    if (!Match(")")) throw new Exception("Expected ')'");
                    return v;
                }
                if (c == '[')
                {
                    _i++;
                    var list = new List<object?>();
                    SkipWs();
                    if (Match("]")) return list;
                    while (true)
                    {
                        list.Add(ParsePrimary());
                        SkipWs();
                        if (Match("]")) break;
                        if (!Match(",")) throw new Exception("Expected ',' or ']'");
                    }
                    return list;
                }
                if (c == '\'' || c == '"')
                {
                    var quote = c; _i++;
                    var sb = new StringBuilder();
                    while (_i < _s.Length && _s[_i] != quote) { sb.Append(_s[_i]); _i++; }
                    if (_i >= _s.Length) throw new Exception("Unterminated string");
                    _i++;
                    return sb.ToString();
                }
                if (c == '{' && _i + 1 < _s.Length && _s[_i + 1] == '{')
                {
                    var end = _s.IndexOf("}}", _i, StringComparison.Ordinal);
                    if (end < 0) throw new Exception("Unterminated {{ }}");
                    var path = _s.Substring(_i + 2, end - _i - 2).Trim();
                    _i = end + 2;
                    return Unwrap(Resolve(_ctx, path));
                }
                if (char.IsDigit(c) || (c == '-' && _i + 1 < _s.Length && char.IsDigit(_s[_i + 1])))
                {
                    var start = _i; _i++;
                    while (_i < _s.Length && (char.IsDigit(_s[_i]) || _s[_i] == '.')) _i++;
                    return double.Parse(_s.Substring(start, _i - start), CultureInfo.InvariantCulture);
                }
                if (char.IsLetter(c) || c == '_')
                {
                    var start = _i;
                    while (_i < _s.Length && (char.IsLetterOrDigit(_s[_i]) || _s[_i] == '_' || _s[_i] == '.')) _i++;
                    var word = _s.Substring(start, _i - start);
                    switch (word.ToLowerInvariant())
                    {
                        case "true": return true;
                        case "false": return false;
                        case "null": return null;
                        case "exists":
                        case "empty":
                            {
                                SkipWs();
                                if (!Match("(")) throw new Exception($"Expected '(' after {word}");
                                SkipWs();
                                var pstart = _i;
                                while (_i < _s.Length && _s[_i] != ')') _i++;
                                var path = _s.Substring(pstart, _i - pstart).Trim().Trim('{', '}', ' ');
                                if (!Match(")")) throw new Exception("Expected ')'");
                                var node = Resolve(_ctx, path);
                                var exists = node != null && !(node is JsonValue jv && jv.TryGetValue<string>(out var sv) && sv.Length == 0);
                                return word.Equals("exists", StringComparison.OrdinalIgnoreCase) ? exists : !exists;
                            }
                    }
                    // bare path (without braces)
                    return Unwrap(Resolve(_ctx, word));
                }
                throw new Exception($"Unexpected character '{c}' at {_i}");
            }

            private static object? Unwrap(JsonNode? n)
            {
                if (n == null) return null;
                if (n is JsonValue v)
                {
                    if (v.TryGetValue<bool>(out var b)) return b;
                    if (v.TryGetValue<double>(out var d)) return d;
                    if (v.TryGetValue<string>(out var s)) return s;
                    return v.ToJsonString().Trim('"');
                }
                return n;
            }

            private static string Str(object? o) => o switch
            {
                null => "",
                string s => s,
                bool b => b ? "true" : "false",
                double d => d.ToString("0.####", CultureInfo.InvariantCulture),
                JsonNode n => NodeToString(n),
                _ => o.ToString() ?? ""
            };

            private static bool? Compare(object? l, object? r, string op)
            {
                // numeric when both parse as numbers
                if (TryNum(l, out var ln) && TryNum(r, out var rn))
                {
                    return op switch
                    {
                        "==" => Math.Abs(ln - rn) < 1e-9,
                        "!=" => Math.Abs(ln - rn) >= 1e-9,
                        ">" => ln > rn,
                        "<" => ln < rn,
                        ">=" => ln >= rn,
                        "<=" => ln <= rn,
                        _ => null
                    };
                }
                if (l is bool || r is bool)
                {
                    var lb = Truthy(l); var rb = Truthy(r);
                    return op == "==" ? lb == rb : op == "!=" ? lb != rb : null;
                }
                var ls = Str(l); var rs = Str(r);
                var cmp = string.Compare(ls, rs, StringComparison.OrdinalIgnoreCase);
                return op switch
                {
                    "==" => cmp == 0,
                    "!=" => cmp != 0,
                    ">" => cmp > 0,
                    "<" => cmp < 0,
                    ">=" => cmp >= 0,
                    "<=" => cmp <= 0,
                    _ => null
                };
            }

            private static bool TryNum(object? o, out double d)
            {
                switch (o)
                {
                    case double x: d = x; return true;
                    case string s when double.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out var p): d = p; return true;
                    default: d = 0; return false;
                }
            }

            private void SkipWs() { while (_i < _s.Length && char.IsWhiteSpace(_s[_i])) _i++; }

            private bool Match(string tok)
            {
                SkipWs();
                if (string.CompareOrdinal(_s, _i, tok, 0, tok.Length) == 0) { _i += tok.Length; return true; }
                return false;
            }

            private bool MatchWord(string word)
            {
                SkipWs();
                if (_i + word.Length <= _s.Length &&
                    string.Compare(_s, _i, word, 0, word.Length, StringComparison.OrdinalIgnoreCase) == 0 &&
                    (_i + word.Length == _s.Length || !char.IsLetterOrDigit(_s[_i + word.Length])))
                {
                    _i += word.Length; return true;
                }
                return false;
            }
        }

        // ── JSON helpers used by the engine ───────────────────────────────────────────
        public static JsonObject ToJsonObject(object? value)
        {
            if (value == null) return new JsonObject();
            var node = JsonSerializer.SerializeToNode(value, JsonOpts);
            return node as JsonObject ?? new JsonObject();
        }

        public static readonly JsonSerializerOptions JsonOpts = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
            PropertyNameCaseInsensitive = true
        };

        public static string? GetString(Dictionary<string, JsonElement> cfg, string key)
        {
            if (!cfg.TryGetValue(key, out var el)) return null;
            return el.ValueKind switch
            {
                JsonValueKind.String => el.GetString(),
                JsonValueKind.Number => el.GetRawText(),
                JsonValueKind.True => "true",
                JsonValueKind.False => "false",
                JsonValueKind.Null or JsonValueKind.Undefined => null,
                _ => el.GetRawText()
            };
        }

        public static double? GetNumber(Dictionary<string, JsonElement> cfg, string key)
        {
            if (!cfg.TryGetValue(key, out var el)) return null;
            if (el.ValueKind == JsonValueKind.Number) return el.GetDouble();
            if (el.ValueKind == JsonValueKind.String && double.TryParse(el.GetString(), NumberStyles.Float, CultureInfo.InvariantCulture, out var d)) return d;
            return null;
        }

        public static bool GetBool(Dictionary<string, JsonElement> cfg, string key, bool @default = false)
        {
            if (!cfg.TryGetValue(key, out var el)) return @default;
            return el.ValueKind switch
            {
                JsonValueKind.True => true,
                JsonValueKind.False => false,
                JsonValueKind.String => string.Equals(el.GetString(), "true", StringComparison.OrdinalIgnoreCase),
                _ => @default
            };
        }

        public static JsonElement? GetElement(Dictionary<string, JsonElement> cfg, string key)
            => cfg.TryGetValue(key, out var el) && el.ValueKind != JsonValueKind.Null && el.ValueKind != JsonValueKind.Undefined ? el : null;
    }
}
