import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import useAxios from "../hooks/useAxios"; // Adjust the import path as necessary
import {
  Button,
  Header,
  Grid,
  Divider,
  Form,
  Segment,
  Image,
  Menu,
  MenuItem,
  FormGroup,
  FormButton,
  FormInput,
  MenuMenu,
  Container,
} from "semantic-ui-react";
import {
  TableHeader,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
} from "semantic-ui-react";
import Skeleton from "./Skeleton"; // Adjust the import path as necessary
import { message, createDataItemSigner, result } from "@permaweb/aoconnect";
import { PermissionType } from "arconnect";

// Define types for route parameters
type RouteParams = {
  id: string;
};

type CoinResponse = {
  name: string;
  image: {
    small: string;
  };
  sentiment_votes_up_percentage: number;
  sentiment_votes_down_percentage: number;
  id: string;
  symbol: string;
  market_data: {
    current_price: {
      usd: number;
    };
  };
};

// Time Decay Function
const timeDecay = (expiryMinutes: number) => {
  const decayFactor = Math.exp(-expiryMinutes / 60); // assuming 60 minutes for full decay
  return decayFactor;
};

// Adjust Probability Function
const adjustProbability = (
  prob: number,
  spread: number = 0,
  expiryMinutes: number = 0
) => {
  // Apply a nonlinear transformation (e.g., exponential) to adjust probability
  const adjustedProb = Math.exp(prob / 100) / Math.exp(1);

  // Apply time decay
  const decayFactor = timeDecay(expiryMinutes);
  const timeAdjustedProb = adjustedProb * decayFactor;

  return timeAdjustedProb * (1 + spread);
};

// Define the CoinDetail component
const CoinDetail: React.FC = () => {
  const { id } = useParams<RouteParams>();
  const { response } = useAxios<CoinResponse>(`coins/${id}`);
  console.log(response);

  const [betAmountCall, setBetAmountCall] = useState("");
  const [betAmountPut, setBetAmountPut] = useState("");
  const [expiryDayCall, setExpiryDayCall] = useState(5); // Default to minimum value of 5
  const [expiryDayPut, setExpiryDayPut] = useState(5); // Default to minimum value of 5

  const [isLoadingCall, setIsLoadingCall] = useState(false);
  const [isLoadingPut, setIsLoadingPut] = useState(false);
  const [isLoadingClaim, setIsLoadingClaim] = useState(false);
  const [responseMessage, setResponseMessage] = useState<string | null>(null);

  const [claimSuccess, setSuccess] = useState(false);

  const [oddsDown, setOddsDown] = useState<string>("");
  const [oddsUp, setOddsUp] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    calculatePayoffs();
  }, [betAmountCall, betAmountPut, expiryDayCall, expiryDayPut]);

  const calculatePayoffs = () => {
    if (!response) {
      setErrorMessage("Response data is missing.");
      return;
    }
    const sentimentVotesDownPercentage =
      response?.sentiment_votes_down_percentage!;
    const sentimentVotesUpPercentage = response?.sentiment_votes_up_percentage!;
    const expiryMinutesCall = expiryDayCall; // Get the expiry time in minutes from input
    const expiryMinutesPut = expiryDayPut; // Get the expiry time in minutes from input

    // Determine which side has the higher probability
    const isDownHigher =
      sentimentVotesDownPercentage > sentimentVotesUpPercentage;

    // Define the spread
    const totalSpread = 0.3;

    // Apply the spread split
    const lowerSpread = (2 / 3) * totalSpread;
    const higherSpread = (1 / 3) * totalSpread;

    const adjustedDownProbability = adjustProbability(
      sentimentVotesDownPercentage,
      isDownHigher ? higherSpread : lowerSpread,
      expiryMinutesPut
    );
    const adjustedUpProbability = adjustProbability(
      sentimentVotesUpPercentage,
      isDownHigher ? lowerSpread : higherSpread,
      expiryMinutesCall
    );

    // Normalize the probabilities to ensure they sum to 1
    const totalAdjustedProbability =
      adjustedDownProbability + adjustedUpProbability;
    const normalizedDownProbability =
      adjustedDownProbability / totalAdjustedProbability;
    const normalizedUpProbability =
      adjustedUpProbability / totalAdjustedProbability;

    // Calculate the odds
    setOddsDown((1 / normalizedDownProbability).toFixed(3));
    setOddsUp((1 / normalizedUpProbability).toFixed(3));
    setErrorMessage("");
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    const numericValue = parseFloat(value);
    switch (name) {
      case "betAmountCall":
        setBetAmountCall(value);
        break;
      case "betAmountPut":
        setBetAmountPut(value);
        break;
      case "expiryDayCall":
        if (numericValue >= 5) {
          setErrorMessage("");
          setExpiryDayCall(numericValue);
        } else {
          setErrorMessage("Expiry time must be at least 5 minutes.");
        }
        break;
      case "expiryDayPut":
        if (numericValue >= 5) {
          setErrorMessage("");
          setExpiryDayPut(numericValue);
        } else {
          setErrorMessage("Expiry time must be at least 5 minutes.");
        }
        break;
      default:
        break;
    }
  };

  if (!response) {
    return (
      <div className="wrapper-container mt-8">
        <Skeleton className="h-8 w-32 mb-4" />
        <Skeleton className="h-72 w-full mb-10" />
      </div>
    );
  }

  return (
    <Container>
      <Menu pointing secondary>
        <MenuItem>
          <Form>
            <FormGroup>
              <FormInput type="number" size="mini" placeholder="Amount" />
              <FormButton secondary size="mini" content="Unstake." />
            </FormGroup>
          </Form>
        </MenuItem>
        <MenuMenu position="right">
          <MenuItem>
            <Form>
              <FormGroup>
                <FormInput type="number" size="mini" placeholder="Amount" />
                <FormButton size="mini" primary content="Stake." />
              </FormGroup>
            </Form>
          </MenuItem>
        </MenuMenu>
      </Menu>
      <Header as="h2" color="teal" textAlign="center">
        <Image src="/logox.png" alt="logo" /> Create a Trade.
      </Header>
      <Divider />
      <Grid columns="equal">
        <Divider />
        <Grid.Column>
          <Form size="large">
            <Segment stacked>
              <Image src={response.image.small} wrapped ui={false} />
              <span> Asset Name: {response.name}</span>
              <Divider />
              <span>Asset Id : {response.id}</span>
              <Divider />
              <span>
                Asset Price : {response.market_data.current_price.usd}
              </span>
              <Divider />
              <Form.Input
                type="number"
                name="betAmountCall"
                value={betAmountCall}
                onChange={handleInputChange}
                icon="money"
                iconPosition="left"
                placeholder="Amount of NOT."
              />
              <Form.Input
                fluid
                name="expiryDayCall"
                icon="calendar alternate outline"
                iconPosition="left"
                placeholder="Expiry in Minutes"
                type="number"
                value={expiryDayCall.toString()}
                onChange={handleInputChange}
              />
              <Divider />
              <span>Payout : {oddsUp}</span>
              <Button color="teal" fluid size="small" loading={isLoadingCall}>
                Call
              </Button>
            </Segment>
          </Form>
        </Grid.Column>
        <Grid.Column>
          <Form size="large">
            <Button size="mini" primary loading={isLoadingClaim}>
              Claim NOT
            </Button>
            <Segment stacked>
              <Image src={response.image.small} wrapped ui={false} />
              <span> Asset Name: {response.name}</span>
              <Divider />
              <span>Asset Id : {response.id}</span>
              <Divider />
              <span>
                Asset Price : {response.market_data.current_price.usd}
              </span>
              <Divider />
              <Form.Input
                type="number"
                name="betAmountPut"
                value={betAmountPut}
                onChange={handleInputChange}
                icon="money"
                iconPosition="left"
                placeholder="Amount of NOT."
              />
              <Form.Input
                fluid
                name="expiryDayPut"
                icon="calendar alternate outline"
                iconPosition="left"
                placeholder="Expiry in Minutes"
                type="number"
                value={expiryDayPut.toString()}
                onChange={handleInputChange}
              />
              <Divider />
              <span>Payout : {oddsDown}</span>
              <Button color="red" fluid size="small" loading={isLoadingPut}>
                Put
              </Button>
            </Segment>
          </Form>
        </Grid.Column>
      </Grid>
      {errorMessage && (
        <div style={{ color: "red", textAlign: "center" }}>{errorMessage}</div>
      )}
    </Container>
  );
};

export default CoinDetail;
