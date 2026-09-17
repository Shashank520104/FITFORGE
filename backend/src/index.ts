import express from "express";

const app = express();


app.use((req, res, next) => {
  console.log(req.method, req.url);
  next();
});

app.get("/", (req, res) => {
  res.send("Welcome to FITFORGE");
});

app.get("/health", (req, res) => {
    res.json({
        status:true,
        message:"FITFORGE Server is healthy"
    });
});


app.get("/api/v1/users/:id", (req, res) => {
  const userId = req.params.id;

  res.json({
    success: true,
    userId: userId
  });
});


app.get("/api/v1/workouts", (req, res) => {
  const muscle = req.query.muscle;
  const difficulty = req.query.difficulty;

  res.json({
    success: true,
    filters: {
      muscle: muscle,
      difficulty: difficulty
    }
  });
});


app.post("/api/v1/users", (req, res) => {
  console.log(req.body);

  res.status(201).json({
    success: true,
    message: "User created successfully",
    data: req.body
  });
});



app.patch("/api/v1/users/:id", (req, res) => {
  const userId = req.params.id;
  const notify = req.query.notify;
  const updates = req.body;

  res.json({
    success: true,
    message: "User update received",
    data: {
      userId,
      notify,
      updates
    }
  });
});

app.use((req, res) => {
  res.status(404).send("Route not found");
});

app.listen(3000, () => {
  console.log("FITFORGE server running on port 3000");
});