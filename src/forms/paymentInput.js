import {
  Button,
  FormErrorMessage,
  FormLabel,
  Input,
  InputGroup,
  InputRightAddon,
  Select,
  Tooltip,
} from '@chakra-ui/react';
import { RiInformationLine } from 'react-icons/ri';
import TextBox from '../components/TextBox';
import React, { useState, useEffect } from 'react';
import { useDao } from '../contexts/DaoContext';

const defaultTipLabel = 'Request funds from the DAO';

const PaymentInput = ({
  errors,
  formLabel = 'Payment Requested',
  getValues,
  register,
  setValue,
  tipLabel = defaultTipLabel,
}) => {
  const [balance, setBalance] = useState(0);

  const [tokenData, setTokenData] = useState([]);
  const { daoOverview } = useDao();

  // const watchToken = watch('paymentToken', '');

  useEffect(() => {
    if (daoOverview && !tokenData.length) {
      const depositTokenAddress = daoOverview.depositToken.tokenAddress;
      const depositToken = daoOverview.tokenBalances.find(
        (token) =>
          token.guildBank && token.token.tokenAddress === depositTokenAddress,
      );
      const tokenArray = daoOverview.tokenBalances.filter(
        (token) =>
          token.guildBank && token.token.tokenAddress !== depositTokenAddress,
      );
      tokenArray.unshift(depositToken);
      setTokenData(
        tokenArray.map((token) => ({
          label: token.token.symbol || token.tokenAddress,
          value: token.token.tokenAddress,
          decimals: token.token.decimals,
          balance: token.tokenBalance,
        })),
      );
    }
    // eslint-disable-next-line
  }, [daoOverview]);

  useEffect(() => {
    if (tokenData.length) {
      const depositToken = tokenData[0];
      getMax(depositToken.value);
      setMax();
    }
    // eslint-disable-next-line
  }, [tokenData]);

  const handleChange = async () => {
    const paymentToken = getValues('paymentToken');
    if (tokenData.length && paymentToken) {
      getMax(paymentToken);
    }
  };

  const getMax = async (token) => {
    const selected = tokenData.find((item) => item.value === token);
    if (selected) {
      setBalance(selected.balance / 10 ** selected.decimals);
    }
  };

  const setMax = async () => {
    setValue('paymentRequested', balance);
  };

  const validateBalance = (value) => {
    let error;
    if (value <= 0) {
      error = 'Payment Requested must be greater than zero';
    }
    if (value > balance) {
      error = 'Payment Requested is more than the dao has';
    }
    return error || true;
  };

  return (
    <>
      <Tooltip hasArrow shouldWrapChildren label={tipLabel} placement='top'>
        <TextBox as={FormLabel} size='xs' d='flex' alignItems='center'>
          {formLabel} <RiInformationLine style={{ marginLeft: 5 }} />
        </TextBox>
      </Tooltip>
      <InputGroup>
        <Button
          onClick={() => setMax()}
          size='xs'
          position='absolute'
          right='0'
          top='-30px'
          variant='outline'
        >
          Max: {balance && balance.toFixed(4)}
        </Button>
        <Input
          name='paymentRequested'
          placeholder='0'
          mb={5}
          ref={register({
            pattern: {
              value: /[0-9]/,
              message: 'Payment must be a number',
            },
            validate: validateBalance,
          })}
          color='white'
          focusBorderColor='secondary.500'
        />
        <InputRightAddon background='primary.500' p={0}>
          <Select
            name='paymentToken'
            ref={register}
            onChange={handleChange}
            color='white'
            background='primary.500'
            w='100%'
          >
            {' '}
            {tokenData.map((token, idx) => (
              <option key={idx} default={!idx} value={token.value}>
                {token.label}
              </option>
            ))}
          </Select>
        </InputRightAddon>
      </InputGroup>

      <FormErrorMessage>
        {errors.paymentToken && errors.paymentToken.message}
      </FormErrorMessage>
    </>
  );
};

export default PaymentInput;
