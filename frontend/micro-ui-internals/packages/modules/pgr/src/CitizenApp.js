import React from "react";
import { Route, BrowserRouter as Router } from "react-router-dom";
import ComplaintsPage from "./pages/Complaints";
import RatingAndFeedBack from "./pages/Rating/Rating";

const Create = () => {
  console.log("hi");
  return <div>Create Complaint</div>;
};

const App = () => {
  console.log("citizen app loaded");
  return (
    <Router>
      <Route exact path="/" component={Create} />
      <Route path="/complaints" component={ComplaintsPage} />
      <Route exact path="/rating" component={RatingAndFeedBack} />
      {/* <Route exact path="/rating" component={RatingAndFeedBack} /> */}
    </Router>
  );
};

export default App;
