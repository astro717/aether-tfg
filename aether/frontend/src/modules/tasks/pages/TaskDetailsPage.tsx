import {
    Plus,
    Maximize2,
    Bot,
} from "lucide-react";

export function TaskDetailsPage() {
    return (
        <div className="p-8 max-w-[1600px] mx-auto">
            <div className="grid grid-cols-12 gap-8">
                {/* LEFT COLUMN (Main Content) */}
                <div className="col-span-8 space-y-8">
                    {/* Header */}
                    <div>
                        <h1 className="text-4xl font-semibold text-gray-900 mb-2">
                            Build API
                        </h1>
                    </div>

                    {/* Description */}
                    <div>
                        <h3 className="text-gray-500 font-medium mb-3">Description</h3>
                        <div className="bg-[#EAEBED] rounded-[24px] p-6 text-gray-600 leading-relaxed shadow-sm">
                            Build a new REST API to handle product data and expose it to the
                            frontend. The API should support basic CRUD operations (create,
                            read, update, delete) for product information, including name,
                            description, price and stock quant...
                        </div>
                    </div>

                    {/* Stats & Commits Grid */}
                    <div className="grid grid-cols-12 gap-6">
                        {/* Stats */}
                        <div className="col-span-5 space-y-4 py-2">
                            <StatRow label="Commit number" value="12" />
                            <StatRow label="Duration" value="1 week 2 days" />
                            <StatRow label="Due date" value="13 Oct" />
                            <StatRow label="Time left" value="2 days 19 hours" />
                        </div>

                        {/* Commit List */}
                        <div className="col-span-7">
                            <h3 className="text-gray-500 font-medium mb-3">Commit list</h3>
                            <div className="bg-[#F4F4F5] rounded-[24px] p-5 space-y-4">
                                <CommitItem
                                    hash="astro717"
                                    date="Sat, Oct 10, 2025, 9:42 AM +0200"
                                    message="committed on Oct 10, 2025"
                                />
                                <CommitItem
                                    hash="astro717"
                                    date="Sat, Oct 10, 2025, 7:58 AM +0200"
                                    message="committed on Oct 10, 2025"
                                />
                                <CommitItem
                                    hash="astro717"
                                    date="Mon, Oct 6, 2025, 8:23 AM +0200"
                                    message="committed on Oct 6, 2025"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Last Commit / Diff */}
                    <div>
                        <h3 className="text-gray-500 font-medium mb-3">Last commit</h3>
                        <div className="bg-[#F4F4F5] rounded-[32px] p-6 relative overflow-hidden">
                            {/* Header inside diff */}
                            <div className="flex items-center justify-between mb-6">
                                <span className="text-gray-500 font-medium">diff: 12/12</span>
                                <button className="text-gray-400 hover:text-gray-600">
                                    <Maximize2 size={18} />
                                </button>
                            </div>

                            {/* Code Diff Content */}
                            <div className="font-mono text-sm leading-6">
                                <div className="text-red-400 opacity-60">
                                    - from flask import Flask
                                </div>
                                <div className="text-green-500 font-medium">
                                    + from flask import Flask, jsonify, request
                                </div>
                                <br />
                                <div className="text-gray-700 font-semibold">
                                    app = Flask(__name__)
                                </div>
                                <br />
                                <div className="text-red-400 opacity-60">
                                    - @app.route("/")
                                </div>
                                <div className="text-red-400 opacity-60">- def hello():</div>
                                <div className="text-red-400 opacity-60">
                                    - return "Hello World!"
                                </div>
                                <div className="text-green-500 font-medium">
                                    + @app.route("/api/products", methods=["GET"])
                                </div>
                                <div className="text-green-500 font-medium">
                                    + def get_products():
                                </div>
                                <div className="text-green-500">
                                    + # TODO: replace mock data with DB query
                                </div>
                                <div className="text-green-500">+ products = [</div>
                                <div className="text-green-500">
                                    + {"    "}{`{"id": 1, "name": "Laptop", "price": 1200},`}
                                </div>
                                <div className="text-green-500">
                                    + {"    "}{`{"id": 2, "name": "Phone", "price": 800}`}
                                </div>
                                <div className="text-green-500">+ ]</div>
                                <div className="text-green-500">
                                    + return jsonify(products)
                                </div>
                                <br />
                                <div className="text-gray-500">@app.route("/status")</div>
                                <div className="text-gray-700">def status():</div>
                                <div className="text-gray-700 pl-4">return "OK"</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN (Sidebar Details) */}
                <div className="col-span-4 flex flex-col space-y-8">
                    {/* Top Date */}
                    <div className="text-right">
                        <span className="text-red-400 font-medium">13 October 12AM</span>
                    </div>

                    {/* Comments */}
                    <div className="flex-1 flex flex-col min-h-0">
                        <div className="bg-[#EAEBED] rounded-[24px] p-4 space-y-4 flex-1 overflow-y-auto max-h-[420px]">
                            {/* Header migrated inside */}
                            <div className="flex items-center justify-between mb-2 px-1">
                                <h3 className="text-gray-500 font-medium text-sm">Comments</h3>
                                <button className="text-gray-400 hover:text-gray-600 transition-colors">
                                    <Plus size={18} />
                                </button>
                            </div>

                            <CommentCard
                                author="Steve Jobs"
                                role="S"
                                content="It's a good start, but it still feels like a tool, not a product. The API should be invisible — effortless, elegant, and obvious in how it works. Keep polishing it until it feels simple, not just functional."
                            />
                            <CommentCard
                                author="Lisa Brennan"
                                role="L"
                                content='"Looks solid, but have you thought about what happens if the request fails? The best design anticipates mistakes."'
                            />
                            <CommentCard
                                author="Tim Cook"
                                role=""
                                content="Can you have it ready a day earlier? I'd like to review it before the deadline — details make the difference."
                            />
                        </div>
                    </div>

                    {/* AI Cards */}
                    <div className="space-y-4">
                        {/* Generate Commit Explanation */}
                        <div className="bg-[#F4F4F5] rounded-[24px] p-6 relative group cursor-pointer hover:bg-white hover:shadow-sm transition-all">
                            <button className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                                <Maximize2 size={16} />
                            </button>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center">
                                    <Bot size={18} className="text-gray-600" />
                                </div>
                                <h4 className="text-gray-400 font-medium text-sm">Generate commit explanation</h4>
                            </div>
                            <p className="text-gray-500 text-sm leading-relaxed">
                                This commit introduces a new API endpoint to provide product information through a REST interface.<br /><br />
                                The previous "Hello World" route was removed, and a structured /api/products route was added. This route currently serves mock product data and will likely be connected to a real database later.<br />
                                The change also imports new Flask utilities (jsonif...
                            </p>
                        </div>

                        {/* Bottom Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            {/* Analyze Code */}
                            <div className="bg-[#F4F4F5] rounded-[24px] p-6 flex flex-col items-center justify-center text-center gap-3 min-h-[160px] cursor-pointer hover:bg-white hover:shadow-sm transition-all">
                                <div className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center mb-1">
                                    <Bot size={18} className="text-gray-600" />
                                </div>
                                <h4 className="text-gray-700 font-medium text-sm leading-tight">
                                    Analyze code and vulnerabilities
                                </h4>
                                <p className="text-gray-300 text-xs mt-2">
                                    The code has not been analyzed yet
                                </p>
                            </div>

                            {/* Generate Report */}
                            <div className="bg-[#F4F4F5] rounded-[24px] p-6 flex flex-col items-center justify-center text-center gap-3 min-h-[160px] cursor-pointer hover:bg-white hover:shadow-sm transition-all">
                                <div className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center mb-1">
                                    <Bot size={18} className="text-gray-600" />
                                </div>
                                <h4 className="text-gray-700 font-medium text-sm leading-tight">
                                    Generate task report
                                </h4>
                                <p className="text-gray-300 text-xs mt-2">
                                    The task has to be done to generate a report
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Sub-components

function StatRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-baseline mb-3 last:mb-0">
            <span className="text-[#A1A1AA] w-32 font-medium">{label}</span>
            <span className="text-[#A1A1AA] hidden sm:inline mr-4">|</span>
            <span className="text-gray-600 font-medium">{value}</span>
        </div>
    );
}

function CommitItem({
    hash,
    date,
    message,
}: {
    hash: string;
    date: string;
    message: string;
}) {
    return (
        <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-gray-800">{date}</span>
                <span className="text-[11px] text-gray-400">—</span>
                <span className="text-[11px] text-gray-500 font-medium">{hash}</span>
            </div>
            <div className="text-[11px] text-gray-500">{message}</div>
        </div>
    );
}

function CommentCard({
    author,
    role,
    content,
}: {
    author: string;
    role: string;
    content: string;
}) {
    return (
        <div className="bg-[#FCFCFD] rounded-[24px] p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
                {role ? (
                    <div className="w-5 h-5 rounded-full bg-gray-500 flex items-center justify-center text-[10px] text-white font-bold">
                        {role}
                    </div>
                ) : (
                    <div className="w-5 h-5 rounded-full bg-gray-200" />
                )}
                <span className="font-bold text-sm text-gray-900">{author}</span>
            </div>
            <p className="text-[11px] text-gray-500 leading-relaxed font-medium line-clamp-3">
                {content}
            </p>
        </div>
    );
}
