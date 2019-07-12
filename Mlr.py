import numpy as np
from sklearn.linear_model import LinearRegression
import pandas as pd  # To read data

new_model = LinearRegression()

def calculate_regression(filename):
    data = pd.read_csv(filename)  # load data set
    X = data.iloc[:,:-1].values
    Y = data.iloc[:, -1].values
    linear_regressor = LinearRegression()  # create object for the class
    new_model = linear_regressor.fit(X, Y)  # perform linear regression

    predicted_y = new_model.predict(xs)

    return predicted_y

  #   writtenFile = open('TheFitData.txt', 'w')
   # writtenFile.write(''.join(str(x) + ', ' for x in new_model.coef_))
    #writtenFile.close()


if __name__ == "__main__":
    calculate_regression(sys.agrv[1])
