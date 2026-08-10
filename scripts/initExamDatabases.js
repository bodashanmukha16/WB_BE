import mongoose from "mongoose";
import dotenv from "dotenv";
import { getTenantContext } from "../utils/tenantConnectionManager.js";
import resolveStudentBranch from "../utils/branchResolver.js";

dotenv.config();

const INITIAL_EXAMS_DATA = {
  svck: [
    {
      title: "SVCK Mid-I Computer Networks & Security",
      subject: "Computer Networks",
      code: "SVCK-CS301-MID1",
      orgId: "svck",
      category: "Mid-Term Examination",
      durationMinutes: 30,
      totalMarks: 20,
      passPercentage: 40,
      status: "active",
      questions: [
        {
          id: "q1",
          text: "In the OSI reference model, which layer handles logical addressing and packet routing across networks?",
          codeSnippet: "",
          options: ["Data Link Layer", "Network Layer", "Transport Layer", "Application Layer"],
          correctOptionIndex: 1,
          explanation: "The Network Layer (Layer 3) handles logical IP addressing, packet creation, and routing between networks.",
          marks: 2
        },
        {
          id: "q2",
          text: "Examine the socket programming snippet below. Which TCP connection state transition happens when listen() is invoked?",
          codeSnippet: `int sockfd = socket(AF_INET, SOCK_STREAM, 0);\nbind(sockfd, (struct sockaddr *)&servaddr, sizeof(servaddr));\nlisten(sockfd, 5);`,
          options: ["CLOSED to LISTEN", "SYN_SENT to ESTABLISHED", "LISTEN to SYN_RCVD", "ESTABLISHED to CLOSE_WAIT"],
          correctOptionIndex: 0,
          explanation: "listen() puts a TCP socket into passive LISTEN state waiting for client connection requests.",
          marks: 2
        },
        {
          id: "q3",
          text: "What is the primary function of the Address Resolution Protocol (ARP)?",
          codeSnippet: "",
          options: ["Map IP addresses to domain names", "Map IP addresses to MAC addresses", "Encrypt network packets at the transport layer", "Assign dynamic IP addresses to host devices"],
          correctOptionIndex: 1,
          explanation: "ARP resolves 32-bit IPv4 addresses to 48-bit hardware MAC addresses within a local subnet.",
          marks: 2
        },
        {
          id: "q4",
          text: "Given CIDR subnet 192.168.10.0/26, what is the maximum number of usable host IP addresses?",
          codeSnippet: "",
          options: ["64", "62", "128", "30"],
          correctOptionIndex: 1,
          explanation: "A /26 mask leaves 6 host bits. 2^6 = 64 total addresses. Minus Network (0) and Broadcast (63) yields 62 usable hosts.",
          marks: 2
        },
        {
          id: "q5",
          text: "Which of the following routing algorithms suffers from the 'Count-to-Infinity' problem?",
          codeSnippet: "",
          options: ["Link State Routing", "Distance Vector Routing", "Open Shortest Path First (OSPF)", "Border Gateway Protocol (BGP)"],
          correctOptionIndex: 1,
          explanation: "Distance Vector Routing (Bellman-Ford) suffers from count-to-infinity when links break.",
          marks: 2
        }
      ]
    },
    {
      title: "SVCK Python & Algorithmic Data Structures Test",
      subject: "Data Structures in Python",
      code: "SVCK-CS302-PY",
      orgId: "svck",
      category: "Coding & Practical Assessment",
      durationMinutes: 25,
      totalMarks: 20,
      passPercentage: 40,
      status: "active",
      questions: [
        {
          id: "py1",
          text: "What will be the output of the following Python list comprehension?",
          codeSnippet: `nums = [1, 2, 3, 4, 5]\nres = [x**2 for x in nums if x % 2 != 0]\nprint(res)`,
          options: ["[1, 4, 9, 16, 25]", "[1, 9, 25]", "[4, 16]", "[1, 3, 5]"],
          correctOptionIndex: 1,
          explanation: "Odds in nums are 1, 3, 5. Squares are 1, 9, 25.",
          marks: 4
        },
        {
          id: "py2",
          text: "What is the worst-case time complexity of searching an element in a Balanced Binary Search Tree (AVL Tree)?",
          codeSnippet: "",
          options: ["O(1)", "O(log N)", "O(N)", "O(N log N)"],
          correctOptionIndex: 1,
          explanation: "AVL trees guarantee logarithmic height balancing, yielding O(log N) worst-case search.",
          marks: 4
        }
      ]
    },
    {
      title: "SVCK Operating Systems & Kernel Architecture",
      subject: "Operating Systems",
      code: "SVCK-CS303-OS",
      orgId: "svck",
      category: "End-Sem Assessment",
      durationMinutes: 45,
      totalMarks: 30,
      passPercentage: 40,
      status: "upcoming",
      questions: [
        {
          id: "os1",
          text: "Which process scheduling algorithm guarantees minimum average waiting time for a given set of processes?",
          codeSnippet: "",
          options: ["First-Come First-Served (FCFS)", "Shortest Job First (SJF)", "Round Robin (RR)", "Priority Scheduling"],
          correctOptionIndex: 1,
          explanation: "SJF is provably optimal for minimizing average waiting time.",
          marks: 2
        }
      ]
    }
  ],
  aits: [
    {
      title: "AITS Mid-II Java Enterprise & Backend Systems Exam",
      subject: "Java Enterprise Programming",
      code: "AITS-CSE-304-JAVA",
      orgId: "aits",
      category: "Mid-Term Examination",
      durationMinutes: 30,
      totalMarks: 20,
      passPercentage: 40,
      status: "active",
      questions: [
        {
          id: "j1",
          text: "What is the key difference between HashMap and ConcurrentHashMap in Java?",
          codeSnippet: "",
          options: [
            "HashMap is synchronized, ConcurrentHashMap is not",
            "ConcurrentHashMap uses lock striping / bucket locks for thread safety",
            "HashMap allows concurrent reads and writes without exception",
            "ConcurrentHashMap does not support key-value pairs"
          ],
          correctOptionIndex: 1,
          explanation: "ConcurrentHashMap achieves high concurrency by locking specific hash table segments rather than locking the entire map.",
          marks: 2
        },
        {
          id: "j2",
          text: "Analyze the Java multithreading snippet below. What will be printed?",
          codeSnippet: `class Test extends Thread {\n  public void run() {\n    System.out.print("Run ");\n  }\n}\npublic class Main {\n  public static void main(String[] args) {\n    Test t = new Test();\n    t.start();\n    t.start();\n  }\n}`,
          options: [
            "Prints 'Run Run'",
            "Throws IllegalThreadStateException at runtime",
            "Compilation Error",
            "Prints 'Run' once then terminates"
          ],
          correctOptionIndex: 1,
          explanation: "Invoking start() twice on the same Thread instance throws IllegalThreadStateException.",
          marks: 2
        }
      ]
    },
    {
      title: "AITS Placement Readiness & Logical Aptitude Test",
      subject: "General Aptitude",
      code: "AITS-CRT-101",
      orgId: "aits",
      category: "Placement & Aptitude",
      durationMinutes: 20,
      totalMarks: 20,
      passPercentage: 50,
      status: "active",
      questions: [
        {
          id: "ap1",
          text: "A train running at 72 km/h crosses a 200m long platform in 25 seconds. What is the length of the train?",
          codeSnippet: "",
          options: ["300 meters", "250 meters", "500 meters", "200 meters"],
          correctOptionIndex: 0,
          explanation: "72 km/h = 20 m/s. Total distance in 25s = 20 * 25 = 500m. Train length = 500m - 200m = 300m.",
          marks: 4
        }
      ]
    },
    {
      title: "AITS Database Management Systems & SQL Lab",
      subject: "Database Management Systems",
      code: "AITS-CSE-305-DBMS",
      orgId: "aits",
      category: "Upcoming Practical Assessment",
      durationMinutes: 40,
      totalMarks: 25,
      passPercentage: 40,
      status: "upcoming",
      questions: [
        {
          id: "db1",
          text: "Which SQL isolation level prevents Dirty Reads but allows Non-Repeatable Reads?",
          codeSnippet: "",
          options: ["Read Uncommitted", "Read Committed", "Repeatable Read", "Serializable"],
          correctOptionIndex: 1,
          explanation: "Read Committed prevents uncommitted dirty data reads.",
          marks: 2
        }
      ]
    }
  ],
  jntuk: [
    {
      title: "JNTUK R23 Data Structures & Algorithms End-Sem Mock",
      subject: "Data Structures & Algorithms",
      code: "JNTUK-R23-CS201",
      orgId: "jntuk",
      category: "University End-Sem Examination",
      durationMinutes: 30,
      totalMarks: 20,
      passPercentage: 40,
      status: "active",
      questions: [
        {
          id: "jnt1",
          text: "What is the worst-case time complexity of QuickSort?",
          codeSnippet: "",
          options: ["O(N log N)", "O(N)", "O(N²)", "O(log N)"],
          correctOptionIndex: 2,
          explanation: "When array is already sorted and worst pivot is picked repeatedly, QuickSort degrades to O(N²).",
          marks: 2
        },
        {
          id: "jnt2",
          text: "Which graph traversal algorithm uses a Queue data structure?",
          codeSnippet: "",
          options: ["Depth First Search (DFS)", "Breadth First Search (BFS)", "Dijkstra's Algorithm", "Kruskal's Algorithm"],
          correctOptionIndex: 1,
          explanation: "BFS explores neighbors level-by-level using a FIFO Queue.",
          marks: 2
        }
      ]
    },
    {
      title: "JNTUK Formal Languages & Automata Theory Exam",
      subject: "Automata Theory",
      code: "JNTUK-R23-CS202",
      orgId: "jntuk",
      category: "Upcoming Mid Examination",
      durationMinutes: 35,
      totalMarks: 20,
      passPercentage: 40,
      status: "upcoming",
      questions: [
        {
          id: "flat1",
          text: "Which class of languages is recognized by a Deterministic Finite Automaton (DFA)?",
          codeSnippet: "",
          options: ["Regular Languages", "Context-Free Languages", "Context-Sensitive Languages", "Recursively Enumerable"],
          correctOptionIndex: 0,
          explanation: "DFAs recognize Regular Languages.",
          marks: 2
        }
      ]
    }
  ]
};

const initDatabases = async () => {
  try {
    console.log("🚀 Syncing All Active & Upcoming Exams strictly into MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Main MongoDB Connection Established");

    // 1. Seed org exams & questions inside each Organization's DB ('wb_org_[orgId]')
    for (const [orgId, examList] of Object.entries(INITIAL_EXAMS_DATA)) {
      const tenantCtx = getTenantContext(orgId);
      const { Exam, ExamQuestion } = tenantCtx.models;

      for (const examData of examList) {
        let existingExam = await Exam.findOne({ code: examData.code });
        if (!existingExam) {
          existingExam = new Exam({
            title: examData.title,
            subject: examData.subject,
            code: examData.code,
            orgId,
            category: examData.category,
            durationMinutes: examData.durationMinutes,
            totalMarks: examData.totalMarks,
            passPercentage: examData.passPercentage,
            status: examData.status
          });
          await existingExam.save();
          console.log(`📌 Seeded Exam [Status: ${examData.status}] in [wb_org_${orgId}] -> [org_exams]: ${examData.title}`);
        } else {
          // Update status if needed
          existingExam.status = examData.status;
          await existingExam.save();
          console.log(`🔄 Updated Exam [Status: ${examData.status}] in [wb_org_${orgId}] -> [org_exams]: ${examData.title}`);
        }

        // Save Questions to 'exam_questions' collection inside the SAME Organization DB ('wb_org_[orgId]')
        for (const q of examData.questions) {
          const qId = q.id || `q_${Date.now()}_${Math.random()}`;
          await ExamQuestion.updateOne(
            { examId: existingExam._id.toString(), questionId: qId },
            {
              $set: {
                questionId: qId,
                examId: existingExam._id.toString(),
                orgId,
                subject: examData.subject,
                text: q.text,
                codeSnippet: q.codeSnippet || "",
                options: q.options,
                correctOptionIndex: q.correctOptionIndex,
                explanation: q.explanation || "",
                marks: q.marks || 2
              }
            },
            { upsert: true }
          );
        }
      }
    }

    // 2. Seed Sample Results into Branch Collections inside each Organization's DB ('wb_org_[orgId]')
    const sampleSubmissions = [
      {
        examId: "sample_exam_cse",
        examTitle: "Computer Science Benchmark Test",
        userId: "19KH1A0512",
        studentEmail: "student.cse@svck.edu",
        studentName: "Shanmukha (CSE)",
        branch: "cse",
        orgId: "svck",
        score: 18,
        totalMarks: 20,
        percentage: 90,
        grade: "S (Outstanding)",
        passed: true,
        violationsCount: 0,
        timeSpentSeconds: 900
      },
      {
        examId: "sample_exam_ece",
        examTitle: "Embedded Systems & Signal Processing",
        userId: "23A91A0401",
        studentEmail: "student.ece@aits.edu",
        studentName: "Rahul (ECE)",
        branch: "ece",
        orgId: "aits",
        score: 16,
        totalMarks: 20,
        percentage: 80,
        grade: "A+ (Excellent)",
        passed: true,
        violationsCount: 1,
        timeSpentSeconds: 1100
      }
    ];

    for (const sub of sampleSubmissions) {
      const tenantCtx = getTenantContext(sub.orgId);
      const cleanBranch = resolveStudentBranch(sub.branch);
      const BranchModel = tenantCtx.models.getBranchResultsModel(cleanBranch);

      const doc = new BranchModel({ ...sub, branch: cleanBranch });
      await doc.save();
    }

    console.log("\n🎉 Database Synchronization Complete!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error initializing exam databases:", error);
    process.exit(1);
  }
};

initDatabases();
